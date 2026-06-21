function pipeL(funcs) {
    // 1-1, anon function
    // return function(value){
    // 	return funcs.reduce((acc,fun) => acc = fun(acc), value)
    // }

    // 1-2, arrow function 
    return (value) => funcs.reduce((acc, fun) => acc = fun(acc), value)
}


// 1-3, arrow function pipe
const pipe = (funcs) => (value) => funcs.reduce((acc, fun) => acc = fun(acc), value)
