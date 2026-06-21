function shuffle(arr) {
    // i = 0 ~ N - 1 => ( 0~N-1 까지 범위) 랜덤 선택 후 swap
    for (let i = 0; i < arr.length; i++) {
        const j = i + Math.floor(Math.random() * (arr.length - i));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// Math.random => [0,1)