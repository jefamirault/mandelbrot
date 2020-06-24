require 'bigdecimal'
require_relative 'mandelbrot'
require 'yaml'

class Grid
  attr_accessor :center_x, :center_y, :step, :width, :height, :map, :mapfile

  DEFAULT_MAPFILE = 'mapfile.yaml'

  def initialize(x = 0, y = 0, precision = 2, width = 16, height = 9, options = {})
    @center_x = x
    @center_y = y
    if precision % 1 != 0
      raise "Invalid arguments. Precision (#{precision}) must be an integer."
    end
    @step = 2 ** -precision * 1.0
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
        hash[[x,y]] = true
        y -= @step
      end
      x += @step
    end
    hash
  end

  def point(x, y)
    @map[[x,y]]
  end

  def to_yaml(options = nil)
    @map.to_yaml options
  end

  def load(mapfile)
    @map = if File.file?(mapfile)
      YAML.load(File.open(mapfile).read) || {}
    else
      File.open mapfile, 'w'
      {}
    end
  end

  def write(mapfile, options = {})
    if options[:overwrite]
      File.write(mapfile, self.to_yaml)
    end
  end

  def compute_mandelbrot(iterations = 20)
    load(@mapfile)
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
    puts "#{reused} points reused. #{new_points} new points computed. Updating mapfile..."
    write(@mapfile, overwrite: true)
  end
end
