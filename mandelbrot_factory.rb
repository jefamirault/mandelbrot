require_relative 'grid'
require_relative 'renderer'

class MandelbrotFactory
  attr_accessor :x, :y, :mapfile, :export_location
end


# x = 0.2549870375144766
# y = -0.0005679790528465
# width, height = 240, 135
# iterations = 500
# (6..30).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'mapfile1.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end
#
#
# x = -0.7463
# y = 0.1102
# width, height = 240, 135
# iterations = 500
# (6..21).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'mapfile2.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end
#
# x, y = -0.4170662, 0.60295913
# width, height = 240, 135
# iterations = 500
# (6..24).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'mapfile3.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end
#
# x = -0.7453
# y = 0.1127
# width, height = 240, 135
# iterations = 500
# (6..21).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'mapfile4.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end
#
# x = -1.315180982097868
# y = 0.073481649996795
# width, height = 240, 135
# iterations = 500
# (6..30).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'mapfile5.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end

# x = 0.281717921930775
# y = 0.5771052841488505
# width, height = 240, 135
# iterations = 1000
# (6..50).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'mapfile6.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end

#
# x = 0.281717921930775
# y = 0.5771052841488505
# width, height = 480, 270
# iterations = 8000
# (6..53).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'mapfile7.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end


# x = 0.281717921930775
# y = 0.5771052841488505
# width, height = 480, 270
# iterations = 8000
# (6..53).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'mapfile7.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end


x = 0.281717921930775
y = 0.5771052841488505
width, height = 975, 559
iterations = 8000
[48].each do |precision|
  grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/mapfile7.json')
  grid.compute_mandelbrot iterations
  renderer = Renderer.new grid
  [7.0, 7.2, 7.4, 7.6, 7.8, 8.0, 8.2, 8.4, 8.6, 8.8, 9.0].each do |color|
    renderer.render(color)
  end
end
