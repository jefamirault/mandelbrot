require_relative 'grid'

class MandelbrotFactory

end


width, height = 960, 540
(7..12).each do |precision|
  grid = Grid.new(0,0,precision, width, height)
  grid.compute_mandelbrot 40
end
