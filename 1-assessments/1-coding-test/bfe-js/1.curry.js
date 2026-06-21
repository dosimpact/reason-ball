function curry(fn) {
    return function curried(...currentArgs) {
        if (currentArgs.length >= fn.length) {
            return fn.apply(this, currentArgs);
        }
        // 1-1, this 컨텍스트를 유지해야 한다.  
        // return function(...nextArgs){
        //     return curried.apply(this, currentArgs.concat(nextArgs) );
        // }
        // 1-2, bind를 쓰면 더 깔끔하게 개선 
        return curried.bind(this, ...args);
    }
}