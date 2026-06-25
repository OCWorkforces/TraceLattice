/**
 * EdgeEmitter — emits DAG edges for thoughts based on their metadata.
 *
 * Stateless helper extracted from HistoryManager. Holds a reference to an
 * optional `IEdgeStore` and a feature flag (`dagEdges`) gating writes.
 *
 * @module EdgeEmitter
 */

import type { IEdgeStore } from '../../contracts/interfaces.js';
import { getErrorMessage } from '../../errors.js';
import type { Logger } from '../../logger/StructuredLogger.js';
import { NullLogger } from '../../logger/NullLogger.js';
import type { ThoughtData } from '../thought.js';
import type { Edge, EdgeKind } from './Edge.js';
import { generateEdgeId, type BranchId } from '../../contracts/ids.js';

/** Minimal session view needed for edge emission. */
export interface EdgeEmissionSession {
	thought_history: ThoughtData[];
	branches: Record<BranchId, ThoughtData[]>;
}

/** Configuration options for EdgeEmitter. */
export interface EdgeEmitterConfig {
	edgeStore?: IEdgeStore;
	dagEdges?: boolean;
	defaultSessionId: string;
	logger?: Logger;
}

/**
 * Emits DAG edges for thought relationships when an `IEdgeStore` is configured
 * and the `dagEdges` feature flag is enabled. No-ops otherwise.
 */
export class EdgeEmitter {
	private readonly _edgeStore?: IEdgeStore;
	private readonly _dagEdges: boolean;
	private readonly _defaultSessionId: string;
	private readonly _logger: Logger;

	constructor(config: EdgeEmitterConfig) {
		this._edgeStore = config.edgeStore;
		this._dagEdges = config.dagEdges ?? true;
		this._defaultSessionId = config.defaultSessionId;
		this._logger = config.logger ?? new NullLogger();
	}

	/** Returns true when edge emission is active (store + flag both set). */
	public isEnabled(): boolean {
		return this._edgeStore !== undefined && this._dagEdges;
	}

	/**
	 * Emits DAG edges for a thought based on its metadata fields.
	 *
	 * Edge kinds (in priority order):
	 * - branch: branch_from_thought + branch_id → parent.id → current.id
	 * - merge: merge_from_thoughts → source.id → current.id (per source)
	 * - verifies: verification_target + thought_type=verification → current.id → target.id
	 * - critiques: verification_target + thought_type=critique → current.id → target.id
	 * - derives_from: synthesis_sources → source.id → current.id (per source)
	 * - revises: revises_thought → current.id → target.id
	 * - tool_invocation: tool_observation with _resumedFrom → tool_call.id → current.id
	 * - sequence: default chronological link from previous thought (if none of the above)
	 */
	public emitEdgesForThought(session: EdgeEmissionSession, thought: ThoughtData): void {
		if (!this._edgeStore || !this._dagEdges) return;
		if (!thought.id) return;

		const sessionId = thought.session_id ?? this._defaultSessionId;
		const emittedRelational = [
			this._emitBranchEdge(session, thought, sessionId),
			this._emitMergeEdges(session, thought, sessionId),
			this._emitVerificationEdge(session, thought, sessionId),
			this._emitCritiqueEdge(session, thought, sessionId),
			this._emitSynthesisEdges(session, thought, sessionId),
			this._emitRevisionEdge(session, thought, sessionId),
			this._emitToolInvocationEdge(session, thought, sessionId),
		].some((emitted) => emitted);

		if (!emittedRelational) {
			this._emitSequenceEdge(session, thought, sessionId);
		}
	}

	private _emitBranchEdge(
		session: EdgeEmissionSession,
		thought: ThoughtData,
		sessionId: string
	): boolean {
		if (thought.branch_from_thought === undefined || !thought.branch_id) return false;

		const parentId = this.resolveThoughtId(session, thought.branch_from_thought);
		return this._addEdgeIfValid(parentId, thought.id, 'branch', sessionId);
	}

	private _emitMergeEdges(
		session: EdgeEmissionSession,
		thought: ThoughtData,
		sessionId: string
	): boolean {
		let emitted = false;
		for (const src of thought.merge_from_thoughts ?? []) {
			const srcId = this.resolveThoughtId(session, src);
			emitted = this._addEdgeIfValid(srcId, thought.id, 'merge', sessionId) || emitted;
		}
		return emitted;
	}

	private _emitVerificationEdge(
		session: EdgeEmissionSession,
		thought: ThoughtData,
		sessionId: string
	): boolean {
		if (thought.verification_target === undefined || thought.thought_type !== 'verification') return false;

		const targetId = this.resolveThoughtId(session, thought.verification_target);
		return this._addEdgeIfValid(thought.id, targetId, 'verifies', sessionId);
	}

	private _emitCritiqueEdge(
		session: EdgeEmissionSession,
		thought: ThoughtData,
		sessionId: string
	): boolean {
		if (thought.verification_target === undefined || thought.thought_type !== 'critique') return false;

		const targetId = this.resolveThoughtId(session, thought.verification_target);
		return this._addEdgeIfValid(thought.id, targetId, 'critiques', sessionId);
	}

	private _emitSynthesisEdges(
		session: EdgeEmissionSession,
		thought: ThoughtData,
		sessionId: string
	): boolean {
		let emitted = false;
		for (const src of thought.synthesis_sources ?? []) {
			const srcId = this.resolveThoughtId(session, src);
			emitted = this._addEdgeIfValid(srcId, thought.id, 'derives_from', sessionId) || emitted;
		}
		return emitted;
	}

	private _emitRevisionEdge(
		session: EdgeEmissionSession,
		thought: ThoughtData,
		sessionId: string
	): boolean {
		if (thought.revises_thought === undefined) return false;

		const targetId = this.resolveThoughtId(session, thought.revises_thought);
		return this._addEdgeIfValid(thought.id, targetId, 'revises', sessionId);
	}

	private _emitToolInvocationEdge(
		session: EdgeEmissionSession,
		thought: ThoughtData,
		sessionId: string
	): boolean {
		if (thought.thought_type !== 'tool_observation' || thought._resumedFrom === undefined) {
			return false;
		}

		const toolCallId = this.resolveThoughtId(session, thought._resumedFrom);
		const metadata = thought.tool_name !== undefined ? { tool_name: thought.tool_name } : undefined;
		return this._addEdgeIfValid(toolCallId, thought.id, 'tool_invocation', sessionId, metadata);
	}

	private _emitSequenceEdge(
		session: EdgeEmissionSession,
		thought: ThoughtData,
		sessionId: string
	): boolean {
		const history = session.thought_history;
		if (history.length < 2) return false;

		const prev = history[history.length - 2];
		if (!prev?.id) return false;

		return this._addEdgeIfValid(prev.id, thought.id, 'sequence', sessionId);
	}

	/**
	 * Resolves a thought_number to its stable id within the given session.
	 * Searches main history first, then branches.
	 *
	 * @returns The thought's id if found and non-empty, undefined otherwise
	 */
	public resolveThoughtId(
		session: EdgeEmissionSession,
		thoughtNumber: number
	): string | undefined {
		for (const t of session.thought_history) {
			if (t.thought_number === thoughtNumber && typeof t.id === 'string' && t.id.length > 0) {
				return t.id;
			}
		}
		for (const branchThoughts of Object.values(session.branches)) {
			for (const t of branchThoughts) {
				if (t.thought_number === thoughtNumber && typeof t.id === 'string' && t.id.length > 0) {
					return t.id;
				}
			}
		}
		return undefined;
	}

	/**
	 * Adds an edge to the edge store if both endpoints are non-empty strings.
	 * Returns true if added, false if skipped (missing endpoint).
	 * Failures (e.g. self-edge) are caught and logged.
	 */
	private _addEdgeIfValid(
		from: string | undefined,
		to: string | undefined,
		kind: EdgeKind,
		sessionId: string,
		metadata?: Record<string, unknown>
	): boolean {
		if (!from || !to) {
			this._logger.debug('Skipping edge: unresolved endpoint', {
				kind,
				from: from ?? null,
				to: to ?? null,
			});
			return false;
		}
		const edge: Edge = {
			id: generateEdgeId(),
			from: from as Edge['from'],
			to: to as Edge['to'],
			kind,
			sessionId: sessionId as Edge['sessionId'],
			createdAt: Date.now(),
			...(metadata !== undefined ? { metadata } : {}),
		};
		if (!this._edgeStore) {
			this._logger.warn('EdgeStore not available; skipping edge', { kind });
			return false;
		}
		try {
			this._edgeStore.addEdge(edge);
			return true;
		} catch (err) {
			this._logger.info('Failed to add DAG edge', {
				kind,
				error: getErrorMessage(err),
			});
			return false;
		}
	}
}
