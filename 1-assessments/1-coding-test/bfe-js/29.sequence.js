
// /*
// type Callback = (error: Error, data: any) => void

// type AsyncFunc = (
//    callback: Callback,
//    data: any
// ) => void

// */

// /**
//  * @param {AsyncFunc[]} funcs
//  * @return {(callback: Callback) => void}
//  */
function sequence2(funcs){
  // your code here

  return function(cb, init){
    const queue = [...funcs];

    const handleCallback = (err, value)=>{
      if(err) {
        cb(err, value);
      }

      // 시퀀스 종료
      if(queue.length === 0){
        return cb(undefined, value);
      }
      // 이어서
      const nextFunc = queue.shift();
      return nextFunc(handleCallback, value);
    }

    // 1, 초기 실행문제로 바로 실행하지 않는다.
    // const firstFunc = queue.shift();
    // firstFunc(handleCallback, result);
    // 2, undefined
    handleCallback(undefined, init)
  }
}


function sequence(funcs) {
  return function(finalCallback, initialData) {
    // 1. 모든 AsyncFunc를 Promise를 반환하는 함수로 래핑
    const promised = funcs.map(fn => (data) => 
      new Promise((resolve, reject) => {
        fn((err, res) => err ? reject(err) : resolve(res), data);
      })
    );

    // 2. reduce로 순차적 체이닝 형성
    promised.reduce((chain, currentFn) => {
      return chain.then(currentFn);
    }, Promise.resolve(initialData))
    .then(result => finalCallback(undefined, result))
    .catch(err => finalCallback(err));
  };
}


function sequence4(funcs) {
  // 최종적으로 호출될 (callback, data) 형태의 함수를 반환
  return function(finalCallback, initialData) {
    let index = 0;

    const next = (err, currentData) => {
      // 1. 에러가 발생했거나 모든 함수를 다 실행했다면 최종 콜백 실행
      if (err || index === funcs.length) {
        return finalCallback(err, currentData);
      }

      // 2. 현재 순서의 함수를 실행하며, 콜백으로 next를 전달
      const currentFunc = funcs[index++];
      currentFunc(next, currentData);
    };

    // 최초 실행
    next(null, initialData);
  };
}