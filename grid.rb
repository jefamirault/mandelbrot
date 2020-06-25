require_relative 'mandelbrot'
require 'json'
require 'bigdecimal'
require 'colorize'


class Grid
  attr_accessor :center_x, :center_y, :precision, :step, :width, :height, :map, :mapfile

  DEFAULT_MAPFILE = 'mapfile.json'

  def initialize(x = 0, y = 0, precision = 2, width = 16, height = 9, options = {})
    if precision % 1 != 0
      raise "Invalid arguments. Precision (#{precision}) must be an integer."
    end
    @precision = precision
    @step = (BigDecimal(2) ** -precision) * 1.0
    @center_x = nearest_step(x, @step)
    @center_y = nearest_step(y, @step)

    @width = width
    @height = height
    @mapfile = options[:mapfile] || DEFAULT_MAPFILE
  end

  def include?(x, y)
    in_bounds = x >= x_min && x <= x_max && y >= y_min && y <= y_max
    on_step = x / step % 1 == 0 && y / step % 1 == 0

    in_bounds && on_step
  end

  def x_min
    if width.even?
      @center_x - (width / 2) * @step
    else
      @center_x - (width / 2).floor * @step
    end
  end

  def x_max
    if width.even?
      @center_x + (width / 2 - 1) * @step
    else
      @center_x + (width / 2).floor * @step
    end
  end

  def y_min
    if height.even?
      @center_y - height / 2 * @step
    else
      @center_y - (height / 2).floor * @step
    end
  end

  def y_max
    if height.even?
      @center_y + (height / 2 - 1) * @step
    else
      @center_y + (height / 2).floor * @step
    end
  end

  def points
    hash = {}
    x = x_min
    while x <= x_max
      y = y_max
      while y >= y_min
        hash[[x.to_f,y.to_f]] = true
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
    ((number / step).round * step) * 1.0
  end

  def to_yaml(options = nil)
    @map.to_yaml options
  end

  def to_a
    @map.map do |point, data|
      [point[0], point[1], data[0], data[1]]
    end
  end

  def load(mapfile = DEFAULT_MAPFILE)
    t0 = Time.now
    @map = if File.file?(mapfile)
      print "Loading mapfile: #{mapfile}..."
      JSON.parse(File.open(mapfile).read).to_h || {}
    else
      print "Creating mapfile: #{mapfile}..."
      File.open mapfile, 'w'
      {} end
    t1 = Time.now - t0
    puts " (#{t1} seconds)".cyan
    mapfile
  end

  def write(mapfile, options = {})
    puts 'Updating mapfile...'
    t0 = Time.now
    if options[:overwrite]
      File.write(mapfile, @map.to_a)
    end
    t1 = Time.now - t0
    puts "Saved to #{@mapfile} (#{t1} seconds)".green
  end

  def compute_mandelbrot(iterations = 20)
    load(@mapfile)

    puts "Using Center: (#{center_x}, #{center_y}), Step: #{step}, Resolution: #{width}x#{height}"

    print "Analyzing #{number_of_points} points at #{iterations} iterations..."
    t0 = Time.now
    reused = 0
    new_points = 0
    points.each do |point, data|
      if @map[point].nil? || @map[point] === true
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
    puts " (#{t1}) seconds".cyan
    puts "#{reused} points reused.".green + " #{new_points} new points computed.".cyan

    if new_points > 0
      write(@mapfile, overwrite: true)
    end
  end
end
