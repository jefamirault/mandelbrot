require_relative 'grid'
require_relative 'mandelbrot'
require 'oily_png'

class Renderer
  attr_accessor :bitmap, :grid, :colors

  def initialize(grid)
    @grid = grid
    @colors = []                      #  r    g    b    a
    (0..255).each do |red|
      @colors << ChunkyPNG::Color.rgba(red,0,255,255) # blue to purple
    end
    (0..255).to_a.reverse.each do |blue|
      @colors << ChunkyPNG::Color.rgba(255,0, blue,255) # purple to red
    end
    (0..255).each do |green|
      @colors << ChunkyPNG::Color.rgba(255, green,0,255) # red to yellow
    end
    (0..255).to_a.reverse.each do |red|
      @colors << ChunkyPNG::Color.rgba(red,255,0,255) # yellow to green
    end
    (0..255).each do |blue|
      @colors << ChunkyPNG::Color.rgba(0, 255,blue,255) # green to cyan
    end
    (0..255).to_a.reverse.each do |green|
      @colors << ChunkyPNG::Color.rgba(0, green,255,255) # cyan to blue
    end
  end

  def render(color_speed = 12)
    t0 = Time.now
    print "Applying transformations..."
    x_min = grid.x_min
    y_max = grid.y_max
    step = grid.step
    transform = grid.map.map do |point, data|
      x = (point[0] - x_min) / step
      y = (point[1]*-1 + y_max) / step
      color = if data[0] == data[1]
                ChunkyPNG::Color.rgba(0,0,0,255) # black
              else
                @colors[(data[0] + 0) * color_speed % @colors.size]
              end
      [x, y, color]
    end

    t1 = Time.now
    puts " (#{t1 - t0} seconds)".cyan
    png = ChunkyPNG::Image.new(grid.width, grid.height, ChunkyPNG::Color::TRANSPARENT)

    print 'Applying colors...'
    transform.each do |pixel|
      x = pixel[0].round
      y = pixel[1].round

      if x < 0 || x.round >= grid.width
        next
      elsif y < 0 || y >= grid.height
        next
      end

      png[x, y] = pixel[2]
    end

    t2 = Time.now
    puts " (#{t2 - t1} seconds)".cyan
    filename ||= "renders/#{Time.now.to_i}_center#{grid.center_x.to_f}_#{grid.center_y.to_f}_p#{grid.precision}_#{grid.width}x#{grid.height}.png"
    print "Exporting to #{filename}".green
    if png.save(filename, :interlace => true)
      t3 = Time.now
      puts " (#{t3-t2} seconds)".cyan
    else
      'Export error.'.red
    end
  end
end
