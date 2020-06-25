require_relative 'grid'
require_relative 'renderer'

class MandelbrotFactory

end

x, y = -0.4170662, 0.60295913
width, height = 1920, 1080
(7..24).each do |precision|
  grid = Grid.new(x,y,precision, width, height)
  grid.compute_mandelbrot 1000
  puts "step: #{grid.step}, center: (#{grid.center_x}, #{grid.center_y})"
  renderer = Renderer.new(grid)
  renderer.render
end

