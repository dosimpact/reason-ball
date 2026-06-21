/**
 * @param {(...args) => void} func
 * @returns {(...args) => Promise<any}
 */
function promisify(func) {
  return function(...args){
    return new Promise((res,rej)=>{
      func.apply(this, [...args, (err, result)=>{
        if(err){
          return rej(err);
        }
        return res(result);
      }]);
    })
  }
}