require_relative 'grid'
require_relative 'mandelbrot'
require 'oily_png'

class Renderer
  attr_accessor :bitmap, :grid, :colors

  def initialize(grid)
    @grid = grid
    @colors = []                      #  r    g    b    a
    @colors << ChunkyPNG::Color.rgba(  0,   0, 255, 255) # blue
    @colors << ChunkyPNG::Color.rgba( 21,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba( 42,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba( 63,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba( 84,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba(105,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba(127,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba(149,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba(170,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba(191,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba(212,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba(233,   0, 255, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0, 255, 255) # magenta
    @colors << ChunkyPNG::Color.rgba(255,   0, 233, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0, 212, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0, 191, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0, 170, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0, 149, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0, 127, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0, 105, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0,  84, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0,  63, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0,  42, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0,  21, 255)
    @colors << ChunkyPNG::Color.rgba(255,   0,   0, 255) # red
    @colors << ChunkyPNG::Color.rgba(255,  21,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255,  42,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255,  63,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255,  84,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255, 105,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255, 127,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255, 149,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255, 170,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255, 191,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255, 212,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255, 233,   0, 255)
    @colors << ChunkyPNG::Color.rgba(255, 255,   0, 255) # yellow
    @colors << ChunkyPNG::Color.rgba(233, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba(212, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba(191, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba(170, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba(149, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba(127, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba(105, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba( 84, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba( 63, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba( 42, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba( 21, 255,   0, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255,   0, 255) # green
    @colors << ChunkyPNG::Color.rgba(  0, 255,  21, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255,  42, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255,  63, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255,  84, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255, 105, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255, 127, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255, 149, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255, 170, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255, 191, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255, 212, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255, 233, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 255, 255, 255) # cyan
    @colors << ChunkyPNG::Color.rgba(  0, 233, 255, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 212, 255, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 191, 255, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 170, 255, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 149, 255, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 127, 255, 255)
    @colors << ChunkyPNG::Color.rgba(  0, 105, 255, 255)
    @colors << ChunkyPNG::Color.rgba(  0,  84, 255, 255)
    @colors << ChunkyPNG::Color.rgba(  0,  63, 255, 255)
    @colors << ChunkyPNG::Color.rgba(  0,  42, 255, 255)
    @colors << ChunkyPNG::Color.rgba(  0,  21, 255, 255)
  end

  def render
    t0 = Time.now
    transform = grid.map.map do |point, data|
      x = (point[0] - grid.x_min) / grid.step
      y = (point[1]*-1 + grid.y_max) / grid.step
      color = if data[0] == data[1]
                ChunkyPNG::Color.rgba(0,0,0,255) # black
              else
                @colors[(data[0] + 0) % @colors.size]
              end
      [x, y, color]
    end

    png = ChunkyPNG::Image.new(grid.width, grid.height, ChunkyPNG::Color::TRANSPARENT)
    t1 = Time.now
    puts "Transformations completed in #{t1 - t0} seconds"
    puts 'Applying colors...'
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
    puts "Colors added in #{t2 - t1} seconds"
    puts 'Saving...'
    filename ||= "renders/#{Time.now.to_i}_center#{grid.center_x}_#{grid.center_y}_step#{grid.step}_#{grid.width}x#{grid.height}.png"
    if png.save(filename, :interlace => true)
      puts "Exported to #{filename}"
    end
  end
end
