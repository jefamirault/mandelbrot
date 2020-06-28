require_relative 'grid'
require_relative 'mandelbrot'
require 'oily_png'

class Renderer
  attr_accessor :bitmap, :grid, :colors

  RESOLUTIONS = [
      [    1, 1    ], # 0
      [    2, 2    ], # 1
      [    4, 4    ], # 2
      [   16, 9    ], # 3
      [   32, 18   ], # 4
      [   64, 36   ], # 5
      [   96, 54   ], # 6
      [  144, 81   ], # 7
      [  256, 144  ], # 8
      [  320, 180  ], # 9
      [  480, 270  ], # 10
      [  640, 360  ], # 11
      [  960, 540  ], # 12
      [ 1280, 720  ], # 13
      [ 1920, 1080 ], # 14
      [ 2560, 1440 ], # 15
      [ 3200, 1800 ], # 16
      [ 3840, 2160 ], # 17
      [ 7680, 4320 ]  # 18
  ]

  DEFAULT_COLOR_SPEED = 12

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


  def render(options = {})
    t0 = Time.now
    print timestamp + " Applying transformations..."
    x_min = grid.x_min
    y_max = grid.y_max
    step = grid.step
    color_speed = options[:color_speed] || DEFAULT_COLOR_SPEED
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
    benchmark = t1 - t0
    puts " (" + "#{benchmark.round(3)}".cyan + " seconds)"
    png = ChunkyPNG::Image.new(grid.width, grid.height, ChunkyPNG::Color::TRANSPARENT)

    # print 'Applying colors...' # verbose
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
    # puts " (" + "#{t2 - t1}".cyan + " seconds)" # verbose
    export_location = options[:export_location] || 'renders'
    prefix = options[:prefix] || Time.now.to_f
    filename ||= "#{export_location}/#{prefix}_#{grid.center_x.to_f},#{grid.center_y.to_f}_#{grid.width}x#{grid.height}_p#{grid.precision_index}.png"
    print timestamp + " Exporting" + " to " + "#{filename}".green
    if png.save(filename, :interlace => true)
      t3 = Time.now
      benchmark = t3-t2
      puts " (" + "#{benchmark.round(3)}".cyan + " seconds)\n"
    else
      'Export error.'.red
    end
  end

  private

  def timestamp
    "[#{Time.now.strftime('%T.%L')}]".magenta
  end
end
