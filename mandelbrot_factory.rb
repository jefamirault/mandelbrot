require_relative 'grid'
require_relative 'renderer'

class MandelbrotFactory
  attr_accessor :x, :y, :mapfile, :export_location
end


# from the internet!
x = 0.2549870375144766
y = -0.0005679790528465

# x = -0.7463
# y = 0.1102

# x, y = -0.4170662, 0.60295913
# x, y = 0, 0
#
width, height = 3840, 2160
# width, height = 1920, 1080
# width, height = 960, 540
# width, height = 480, 270
# width, height = 240, 135
# width, height = 2,2
precision = 27
iterations = 500

grid = Grid.new(x, y, precision, width, height, mapfile: 'mapfile1.json')
grid.compute_mandelbrot iterations
Renderer.new(grid).render

#
# (12..24).each do |precision|
#   grid = Grid.new(x,y,precision, width, height, mapfile: 'mapfile.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end
#
