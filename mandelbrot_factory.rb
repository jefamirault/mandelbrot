require_relative 'grid'
require_relative 'renderer'

class MandelbrotFactory
  attr_accessor :x, :y, :mapfile, :export_location
end

# Locations to zoom in on

# Cusp
# x = 0.2549870375144766
# y = -0.0005679790528465
# width, height = 240, 135
# iterations = 500
# (6..30).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/cusp/mapfile1.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end

# Seahorse
# x = -0.7463
# y = 0.1102
# width, height = 7680, 4320
# iterations = 1000
# # (6..21).each do |precision|
# (21..21).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/seahorse/mapfile2.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render 3
# end

# Flower
x, y = -0.4170662, 0.60295913
iterations = 1000
width, height = 960, 540
(8..38).each do |precision|
  grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/flower/mapfile3.json')
  grid.compute_mandelbrot iterations
  Renderer.new(grid).render
end

# Seahorse Tail
# x = -0.7453
# y = 0.1127
# width, height = 240, 135
# iterations = 500
# (6..21).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/seahorse_tail/mapfile4.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end

# Lightning
# x = -1.315180982097868
# y = 0.073481649996795
# width, height = 240, 135
# iterations = 500
# (6..30).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/lightning/mapfile5.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end

# Pinwheel Blade
# x = 0.281717921930775
# y = 0.5771052841488505
# width, height = 240, 135
# iterations = 1000
# (6..50).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/pinwheel_blade/mapfile6.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end
