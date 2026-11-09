// Express 4 no captura los errores de los manejadores async: este envoltorio los pasa a `next`.
export const ah = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
