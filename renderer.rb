total_start = Time.now
puts "start time: #{total_start}"

require_relative 'complex_number'
require 'oily_png'

class Renderer


  # no integers please!
  X_MIN = -2.5
  X_MAX = 0.5
  Y_MIN = -1.25
  Y_MAX = 1.25
  PRECISION = 6

  attr_accessor :bitmap, :points, :x_resolution, :y_resolution, :iterations

  def x_range
    (X_MAX - X_MIN).abs
  end

  def y_range
    (Y_MAX - Y_MIN).abs
  end

  def x_step
    (X_MAX - X_MIN) / x_resolution
  end
  def y_step
    (Y_MAX - Y_MIN) / y_resolution
  end

  def initialize(width = 200, length = 200)
    t0 = Time.now
    self.x_resolution = width
    self.y_resolution = length

    x = X_MIN
    @points = [] # [[a, b], ...]
    while x < X_MAX
      y = Y_MIN
      while y < Y_MAX
        @points << [x.round(PRECISION), y.round(PRECISION)]
        y += y_step
      end
      x += x_step
    end
    t1 = Time.now
    puts "checkpoint 1. resolution set: #{x_resolution} x #{y_resolution} (#{t1 - t0} seconds)"

    @bitmap = @points.map do |p|
      [*p, ComplexNumber.new(p[0].round(PRECISION), p[1].round(PRECISION)).member?]
    end
    t2 = Time.now
    puts "checkpoint 2. set membership computed (#{t2 - t1}) seconds"
  end
end


colors = []                      #  r    g    b    a
  colors << ChunkyPNG::Color.rgba(  0,   0, 255, 255) # blue
  colors << ChunkyPNG::Color.rgba( 21,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba( 42,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba( 63,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba( 84,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba(105,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba(127,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba(149,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba(170,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba(191,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba(212,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba(233,   0, 255, 255)
  colors << ChunkyPNG::Color.rgba(255,   0, 255, 255) # magenta
  colors << ChunkyPNG::Color.rgba(255,   0, 233, 255)
  colors << ChunkyPNG::Color.rgba(255,   0, 212, 255)
  colors << ChunkyPNG::Color.rgba(255,   0, 191, 255)
  colors << ChunkyPNG::Color.rgba(255,   0, 170, 255)
  colors << ChunkyPNG::Color.rgba(255,   0, 149, 255)
  colors << ChunkyPNG::Color.rgba(255,   0, 127, 255)
  colors << ChunkyPNG::Color.rgba(255,   0, 105, 255)
  colors << ChunkyPNG::Color.rgba(255,   0,  84, 255)
  colors << ChunkyPNG::Color.rgba(255,   0,  63, 255)
  colors << ChunkyPNG::Color.rgba(255,   0,  42, 255)
  colors << ChunkyPNG::Color.rgba(255,   0,  21, 255)
  colors << ChunkyPNG::Color.rgba(255,   0,   0, 255) # red
  colors << ChunkyPNG::Color.rgba(255,  21,   0, 255)
  colors << ChunkyPNG::Color.rgba(255,  42,   0, 255)
  colors << ChunkyPNG::Color.rgba(255,  63,   0, 255)
  colors << ChunkyPNG::Color.rgba(255,  84,   0, 255)
  colors << ChunkyPNG::Color.rgba(255, 105,   0, 255)
  colors << ChunkyPNG::Color.rgba(255, 127,   0, 255)
  colors << ChunkyPNG::Color.rgba(255, 149,   0, 255)
  colors << ChunkyPNG::Color.rgba(255, 170,   0, 255)
  colors << ChunkyPNG::Color.rgba(255, 191,   0, 255)
  colors << ChunkyPNG::Color.rgba(255, 212,   0, 255)
  colors << ChunkyPNG::Color.rgba(255, 233,   0, 255)
  colors << ChunkyPNG::Color.rgba(255, 255,   0, 255) # yellow
  colors << ChunkyPNG::Color.rgba(233, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba(212, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba(191, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba(170, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba(149, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba(127, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba(105, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba( 84, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba( 63, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba( 42, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba( 21, 255,   0, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255,   0, 255) # green
  colors << ChunkyPNG::Color.rgba(  0, 255,  21, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255,  42, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255,  63, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255,  84, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255, 105, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255, 127, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255, 149, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255, 170, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255, 191, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255, 212, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255, 233, 255)
  colors << ChunkyPNG::Color.rgba(  0, 255, 255, 255) # cyan
  colors << ChunkyPNG::Color.rgba(  0, 233, 255, 255)
  colors << ChunkyPNG::Color.rgba(  0, 212, 255, 255)
  colors << ChunkyPNG::Color.rgba(  0, 191, 255, 255)
  colors << ChunkyPNG::Color.rgba(  0, 170, 255, 255)
  colors << ChunkyPNG::Color.rgba(  0, 149, 255, 255)
  colors << ChunkyPNG::Color.rgba(  0, 127, 255, 255)
  colors << ChunkyPNG::Color.rgba(  0, 105, 255, 255)
  colors << ChunkyPNG::Color.rgba(  0,  84, 255, 255)
  colors << ChunkyPNG::Color.rgba(  0,  63, 255, 255)
  colors << ChunkyPNG::Color.rgba(  0,  42, 255, 255)
  colors << ChunkyPNG::Color.rgba(  0,  21, 255, 255)


r = Renderer.new(1440, 900)

# (-2,-2)

transform = r.bitmap.map do |p|
  x = (p[0] - Renderer::X_MIN) * r.x_resolution / r.x_range
  y = (p[1]*-1 + Renderer::Y_MAX) * r.y_resolution / r.y_range
  color = if p[2] == true
    ChunkyPNG::Color.rgba(0,0,0,255) # black
  else
    colors[(p[2] + 0) % colors.size]
  end
  [x, y, color]
end

# open('bitmap.txt', 'w') do |f|
#   f.puts "var points = ["
#   transform.each do |p|  
#     f.puts "[#{p[0].round(3)}, #{p[1].round(3)}],"
#   end
#   f.puts "[0,0]]" 
# end
t3 = Time.now
png = ChunkyPNG::Image.new(r.x_resolution, r.y_resolution, ChunkyPNG::Color::TRANSPARENT)

# png.rect(0, 0, r.x_resolution-1, r.y_resolution-1, stroke_color = ChunkyPNG::Color::WHITE, fill_color = ChunkyPNG::Color::WHITE)


transform.each do |pixel|
  if pixel[0] < 0 || pixel[0] >= r.x_resolution
    next
  elsif pixel[1] < 0 || pixel[1] >= r.y_resolution
    next
  end
  png[pixel[0].round, pixel[1].round] = pixel[2]
end


png.save("renders/mandelbrot_render.png", :interlace => true)

t4 = Time.now
puts "checkpoint 3. png export finished (#{t4 - t3} seconds)"

total_finish = Time.now
puts "Total Time: #{total_finish - total_start} seconds"
