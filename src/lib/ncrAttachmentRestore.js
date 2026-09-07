export const isNcrAttachmentRestoreReady = (editDoc, restore) => {
    if (!editDoc) return restore?.status === 'idle' && restore?.docId == null;
    return !!editDoc.id && restore?.status === 'ready' && String(restore.docId) === String(editDoc.id);
};
