require_relative 'mandelbrot'
require 'json'
require 'bigdecimal'
require 'colorize'


class Grid
  attr_accessor :center_x, :center_y, :precision_index, :precision, :step, :width, :height, :map, :mapfile

  DEFAULT_MAPFILE = 'mapfile.json'

  def initialize(x = 0, y = 0, precision_index = 2, width = 16, height = 9, options = {})
    if precision_index % 1 != 0
      raise "Invalid arguments. Precision Index (#{precision}) must be an integer."
    end
    @precision_index = precision_index
    @precision = (precision_index / 3).floor

    @step = 10 ** (@precision * -1)

    remainder = precision_index % 3
    precise_step = BigDecimal(@step.to_f.to_s)
    if remainder != 0
      if remainder == 1
        precise_step *= 0.5
        @precision + 0.3
      elsif remainder == 2
        precise_step *= 0.2
      end
      @precision += remainder * 0.25
    end
    @step = precise_step.to_f

    @center_x = nearest_step(x, @step)
    @center_y = nearest_step(y, @step)

    @width = width
    @height = height
    @mapfile = options[:mapfile] || DEFAULT_MAPFILE
  end

  def precise_step
    BigDecimal(@step.to_s)
  end

  def include?(x, y)
    in_bounds = x >= x_min && x <= x_max && y >= y_min && y <= y_max
    on_step = x / step % 1 == 0 && y / step % 1 == 0

    in_bounds && on_step
  end

  def x_min
    center = BigDecimal(@center_x.to_s)
    if width.even?
      center - (width / 2) * precise_step
    else
      center - (width / 2).floor * precise_step
    end.to_f
  end
  def x_max
    center = BigDecimal(@center_x.to_s)
    if width.even?
      center + (width / 2 - 1) * precise_step
    else
      center + (width / 2).floor * precise_step
    end.to_f
  end
  def y_min
    center = BigDecimal(@center_y.to_s)
    if height.even?
      center - height / 2 * precise_step
    else
      (center - (height / 2).floor * precise_step)
    end.to_f
  end
  def y_max
    center = BigDecimal(@center_y.to_s)
    if height.even?
      center + (height / 2 - 1) * precise_step
    else
      center + (height / 2).floor * precise_step
    end.to_f
  end

  def points
    hash = {}
    precise_x = BigDecimal(x_min.to_s)
    precise_y = BigDecimal(y_max.to_s)

    x = precise_x
    while x <= x_max
      y = precise_y
      while y >= y_min
        hash[[x.to_f, y.to_f]] = true
        y -= @step
      end
      x += @step
    end
    hash
  end

  def point(x, y)
    @map[[x,y]]
  end

  def number_of_points
    width * height
  end

  def nearest_step(number, step)
    precise_step = BigDecimal(step.to_f.to_s)
    ((number / step).round * precise_step).to_f
  end

  def to_yaml(options = nil)
    @map.to_yaml options
  end

  def to_a
    @map.map do |point, data|
      [point[0], point[1], data[0], data[1]]
    end
  end

  def load(mapfile = @mapfile)
    t0 = Time.now
    @map = if File.file?(mapfile)
      print "#{timestamp}" + " Loading mapfile: " + "#{mapfile}".green
      JSON.parse(File.open(mapfile).read).to_h || {}
    else
      print "Creating mapfile: " + "#{mapfile}".cyan + "..."
      File.open mapfile, 'w'
      {} end
    t1 = Time.now - t0
    puts " (" + "#{t1.round(3)}".cyan + " seconds)"
    mapfile
  end

  def write(mapfile = @mapfile, options = {})
    print timestamp + " Updating mapfile: " + "#{@mapfile}".green
    t0 = Time.now
    if options[:overwrite]
      File.write(mapfile, @map.to_a)
    end
    t1 = Time.now - t0
    puts " (" + "#{t1}".cyan + " seconds)"
  end

  def compute_mandelbrot(iterations = 20)
    puts "Center".cyan + ": " + "(" + "#{center_x}".red + ", " + "#{center_y}".red + "), " + "Precision Index".cyan + ": " + "#{@precision_index}".red + ", Step".cyan + ": " + "#{step}".red + ", " + "Resolution".cyan + ": " + "#{width}x#{height}".red
    puts "Top Left Corner".cyan + ":  (" + "#{x_min}".red + ", " + "#{y_max}".red + ")" + ", " + "Bottom Right Corner".cyan + ": " + "(" + "#{x_max}".red + ", " + "#{y_min}".red + ")"

    load(@mapfile) if @map.nil?

    print timestamp + " Analyzing " + "#{number_of_points}".cyan + " points at " + "#{iterations}".red + " iterations..."
    t0 = Time.now

    reused = 0
    new_points = 0
    points.each do |point, data|
      if @map[point].nil? # || @map[point] === true
        # puts "Point #{point} has not been tested for membership in the Mandelbrot Set. Computing..."
        number = Complex(*point)
        check = Mandelbrot.new(number, iterations)
        iterates_under_two = check.iterates_under_two
        @map[point] = [iterates_under_two, iterations]
        new_points += 1
      else
        # puts "Point already computed. Iterates under two: #{@map[point][0]}, iterations checked: #{@map[point][1]}"
        reused += 1
      end
    end

    t1 = Time.now - t0
    puts " (" + "#{t1.round(3)}".cyan + " seconds)"
    puts "#{reused} points reused.".green + " #{new_points} new points computed.".cyan

    { reused: reused, new_points: new_points, benchmark: t1}
  end

  private

  def timestamp
    "[#{Time.now.strftime('%T.%L')}]".magenta
  end
end
