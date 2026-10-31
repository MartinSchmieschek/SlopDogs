// SlopDogs kennel list · script: rights. What the caller may do with a row, read from myRights: run only (no code
// behind the row), why Edit is locked (frozen; maintained and not a maintainer), and Delete for owner and editor
// (the server allows both), never on a community, maintained or frozen kennel.
function kennelsRights(K) {
    var COPY = K.COPY;
    K.runOnly = function (k) {
        return k.myRights ? !k.myRights.read : k.visibility === 'run-only';
    };
    K.maintained = function (k) {
        return !!k.myRights && k.myRights.locked === 'landing';
    };
    K.frozen = function (k) {
        return !!(k.frozen || (k.myRights && k.myRights.frozen));
    };
    K.lockOf = function (k) {
        if (K.frozen(k)) return COPY.lockFrozen;
        if (K.maintained(k) && !k.myRights.edit) return COPY.lockMaintained;
        return null;
    };
    K.canDelete = function (k) {
        var r = k.myRights || {};
        return !K.frozen(k) && !K.maintained(k) && (!!r.own || (!!r.edit && !!k.ownerId));
    };
}
return String(kennelsRights);
