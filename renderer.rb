require_relative 'grid'
require_relative 'mandelbrot'
require 'oily_png'

class Renderer
  attr_accessor :bitmap, :grid, :colors, :max_iterations

  RESOLUTIONS = [
      [    2, 2    ], # 0
      [    4, 4    ], # 1
      [    8, 8    ], # 2
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
      [ 5760, 3240 ], # 18
      [ 7680, 4320 ]  # 19
  ]

  DEFAULT_COLOR_SPEED = 12
  # DEFAULT_COLOR_SPEED = 5

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
    color_speed *= 1.0
    transform = grid.points.map do |point, data|
      x = (point[0] - x_min) / step
      y = (point[1]*-1 + y_max) / step
      color = if data[0] >= @max_iterations
                ChunkyPNG::Color.rgba(0,0,0,255) # black
              else
                color_offset = 0
                color_index = (data[0] * color_speed  + color_offset).round % @colors.size
                @colors[color_index]
              end
      # print "#{data[0].round(3)}/#{@max_iterations}, "  # if data[0] > @max_iterations - 1
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

    if options[:scale] && options[:scale] != 1
      puts "Scaling image by #{options[:scale]}"
      png = scale(png, options[:scale])
    end

    t2 = Time.now
    # puts " (" + "#{t2 - t1}".cyan + " seconds)" # verbose
    export_location = options[:export_location] || 'renders'
    prefix = options[:prefix] || ("%.7f" % Time.now.to_f)
    filename ||= "#{export_location}/#{prefix}_#{grid.center_x.to_f},#{grid.center_y.to_f}_#{grid.width}x#{grid.height}_p#{grid.precision_index}_z#{@max_iterations}.png"
    print timestamp + " Exporting" + " to " + "#{filename}".green

    png.metadata['center'] = [grid.center_x, grid.center_y].to_s
    png.metadata['precision'] = grid.precision_index.to_s
    png.metadata['step'] = grid.step.to_s
    png.metadata['scale'] = (options[:scale] || 1).to_s
    png.metadata['max_iterations'] = @max_iterations.to_s
    png.metadata['top_left_corner'] = grid.top_left.to_s
    png.metadata['bottom_right_corner'] = grid.bottom_right.to_s
    png.metadata['color_speed'] = options[:color_speed].to_s

    if png.save(filename, :interlace => true)
      t3 = Time.now
      benchmark = t3-t2
      puts " (" + "#{benchmark.round(3)}".cyan + " seconds)\n"
    else
      'Export error.'.red
    end
  end

  def scale(png, scalar)
    width = png.width
    height = png.height
    new_width = width * scalar
    new_height = height * scalar

    scaled_up = ChunkyPNG::Image.new(new_width, new_height, ChunkyPNG::Color::WHITE)
    width.times do |x|
      height.times do |y|
        scaled_up.rect(x*scalar, y*scalar, (x+1)*scalar-1, (y+1)*scalar-1, png[x,y], png[x,y])
      end
    end
    scaled_up
  end

  private

  def timestamp
    "[#{Time.now.strftime('%T.%L')}]".magenta
  end
end
