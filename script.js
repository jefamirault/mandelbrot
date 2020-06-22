function init() {
    x_min = -1.7868552624511718
    y_max = 0.0000012874603271484376
    step = 0.0000000011920928955
    addMouseListener(x_min, y_max, step)
}


function addMouseListener(x_min, y_max, step) {
    onmousemove = function(e){console.log("mouse location:", e.clientX * step + x_min, e.clientY * -1 * step + y_max)}
}
