function init() {
    top_left_corner = [0.255050484, -0.00064761622]
    x_min = top_left_corner[0]
    y_max =  top_left_corner[1]
    step = 0.00000000002
    addMouseListener(x_min, y_max, step)
}


function addMouseListener(x_min, y_max, step) {
    onmousemove = function(e){console.log("mouse location: (" + (e.clientX * step + x_min) + ", " + (e.clientY * -1 * step + y_max) + ")")}
}
