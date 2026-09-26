// Async permission helpers for node mutation.
//
// SECURITY (2026-09-13): the former "kennel-owner-bypass" — a node was editable by
// every kennel-owner/editor that merely referenced it in dogIds — was a privilege-
// escalation hole. `canMutate` already grants edit rights to the node's own owner,
// its editors, super-users, and community (null-owner) nodes. The bypass therefore
// added exactly ONE thing: the ability to overwrite a node owned by SOMEONE ELSE
// (including another user's PRIVATE dog) simply by naming its lineageId in your own
// kennel. Attacker B could drop A's private lineageId into B's kennel and then
// save_node A's dog with hostile code, which then executed on A's public page.
// There is no legitimate use the bypass covered that canMutate does not already
// cover, so it is removed entirely (fail-closed). Editing a public dog you do not
// own now requires forking it, as it should.

import type { IStore } from '../../store/IStore';
import type { AuthCtx } from './middleware';
import { AclEntity, canMutate } from './visibility';

/**
 * Mutate-check for a node. A node may be changed only by its owner, its editors,
 * a super-user, or (for null-owner community/legacy nodes) any logged-in user —
 * exactly the rules in {@link canMutate}. Referencing a node from a kennel grants
 * NO edit rights over it.
 *
 * @param node        The node entity (must include ownerId, editors).
 * @param ctx         Auth context.
 * @param _kennelStore Unused; retained so callers need not change. The kennel
 *                     manifest is deliberately NOT consulted (see security note above).
 */
export async function canMutateNode(
    node: AclEntity,
    ctx: AuthCtx | undefined,
    _kennelStore: IStore,
): Promise<boolean> {
    return canMutate(node, ctx);
}
