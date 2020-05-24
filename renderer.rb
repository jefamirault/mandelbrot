total_start = Time.now

require_relative 'complex_number'
require 'oily_png'

class Renderer

  PRECISION = 17

  attr_accessor :bitmap, :points, :x_resolution, :y_resolution, :iterations, :x_min, :x_max, :y_min, :y_max, :x_offset, :y_offset, :iterations, :zoom

  def x_range
    (@x_max - @x_min).abs
  end

  def y_range
    (@y_max - @y_min).abs
  end

  def x_step
    x_range / x_resolution
  end
  def y_step
    y_range / y_resolution
  end

  def initialize(iterations = 40, zoom = 1.0, center_x = 0, center_y = 0, width = 960, length = 540)
    self.iterations = iterations
    self.x_resolution = width
    self.y_resolution = length
    self.x_offset = center_x
    self.y_offset = center_y
    self.zoom = zoom * (y_resolution / 540) # scale the zoom with the resolution so you get the same bounds when zoom input is constant
    self.x_max = (width / 400.0) / @zoom + center_x
    self.x_min = (-1 * width / 400.0) / @zoom + center_x
    self.y_max = (length / 400.0) / @zoom + center_y
    self.y_min = (-1 * length / 400.0) / @zoom + center_y

    t0 = Time.now
    puts "Generating Mandelbrot Render #{t0}"
    x = @x_min
    @points = [] # [[a, b], ...]
    # puts "x_min: #{@x_min}"
    while x < @x_max
      y = @y_min
      while y < @y_max
        @points << [x.round(PRECISION), y.round(PRECISION)]
        y += y_step
      end
      x += x_step
    end
    t1 = Time.now
    puts "Resolution Mask created in #{x_resolution} x #{y_resolution} (#{t1 - t0} seconds)"
    puts "Computing set membership for z = #{iterations}..."
    puts "0%... #{Time.now}"
    last = @points.size - 1
    @bitmap = @points.map.with_index do |p, i|
      if i == last / 4
        puts "25%... #{Time.now}"
      elsif i == last/ 2
        puts "50%... #{Time.now}"
      elsif i == 3 * last / 4
        puts "75%... #{Time.now}"
      end
      [*p, ComplexNumber.new(p[0].round(PRECISION), p[1].round(PRECISION)).member?(iterations)]
    end
    t2 = Time.now
    puts "100%. Set membership computed in (#{t2 - t1}) seconds"
  end

  def export_png(filename = nil)
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

    t0 = Time.now
    puts 'Applying transformations...'
    transform = @bitmap.map do |p|
      x = (p[0] - @x_min) * @x_resolution / x_range
      y = (p[1]*-1 + @y_max) * @y_resolution / y_range
      color = if p[2] == true
        ChunkyPNG::Color.rgba(0,0,0,255) # black
      else
        colors[(p[2] + 0) % colors.size]
      end
      [x, y, color]
    end

    png = ChunkyPNG::Image.new(@x_resolution, @y_resolution, ChunkyPNG::Color::TRANSPARENT)
    t1 = Time.now
    puts "Transformations completed in #{t1 - t0} seconds"
    puts 'Applying colors...'
    transform.each do |pixel|
      x = pixel[0].round
      y = pixel[1].round

      if x < 0 || x.round >= @x_resolution
        next
      elsif y < 0 || y >= @y_resolution
        next
      end

      png[x, y] = pixel[2]
    end

    t2 = Time.now
    puts "Colors added in #{t2 - t1} seconds"
    puts 'Saving...'
    filename ||= "renders/#{Time.now.to_i}_center#{x_offset}_#{y_offset}_zoom#{@zoom.round}_#{x_resolution}x#{y_resolution}_z#{iterations}.png"
    if png.save(filename, :interlace => true)
      puts "Exported to #{filename}"
    end
    t3 = Time.now
    puts "Rendered in #{t3 - t2} seconds"
  end
end

# # open('bitmap.txt', 'w') do |f|
# #   f.puts "var points = ["
# #   transform.each do |p|  
# #     f.puts "[#{p[0].round(3)}, #{p[1].round(3)}],"
# #   end
# #   f.puts "[0,0]]" 
# # end

# Origin (0 + 0i)
# Left Blob (-1.765 + 0i)
# Left Blob of the Left Blob (-1.786 + 0i)
# Left Blob^3 (-1.78643 + 0i)
# Starfish (-0.5622026215231 + 0.6428171490727i)

# x = -0.5622026215231
# y =  0.6428171490727

x = -0.5622026215231
y =  0.6428171490727

z = 120
zoom = 2**24
x_resolution, y_resolution = 960, 540
# x_resolution, y_resolution = 1920, 1080
# x_resolution, y_resolution = 3840, 2160
# x_resolution, y_resolution = 7680, 4320

# t0 = Time.now

r = Renderer.new(z, zoom, x, y, x_resolution, y_resolution).export_png


# # x_resolution, y_resolution = 1920, 1080
# # x_resolution, y_resolution = 3840, 2160
# # x_resolution, y_resolution = 7680, 4320
# # r = Renderer.new(240, zoom, x, y, x_resolution, y_resolution).export_png


# t1 = Time.now
# puts "Total Time: #{t1 - t0} seconds"


# x_resolution, y_resolution = 960, 540
# x_resolution, y_resolution = 1920, 1080

# Estimated 12 hours to complete:
# (-10..400).each do |i|
#   zoom = 2**(i/10.0)
#   Renderer.new(z, zoom, x, y, x_resolution, y_resolution).export_png
# end
