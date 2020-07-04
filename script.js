function init() {
    top_left_corner = [0.25505051196, -0.000647632222]
    x_min = top_left_corner[0]
    y_max =  top_left_corner[1]
    step = 0.000000000002
    addMouseListener(x_min, y_max, step)
}


function addMouseListener(x_min, y_max, step) {
    onmousemove = function(e){console.log("mouse location: (" + (e.clientX * step + x_min) + ", " + (e.clientY * -1 * step + y_max) + ")")}
}
