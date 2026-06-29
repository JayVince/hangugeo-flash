/**
 * Enveloppe une route Express async pour que toute erreur (rejet de
 * promesse) soit transmise à next() au lieu d'être perdue ou de
 * planter le processus.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
