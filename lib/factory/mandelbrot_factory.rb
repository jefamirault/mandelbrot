require_relative '../grid'
require_relative '../renderer'

class MandelbrotFactory
  attr_accessor :center, :max_iterations, :precisions, :mapfile, :export_location, :resolutions, :map, :scale, :override_step

  def initialize(x, y, max_iterations, start_precision, end_precision, resolutions, options = {})
    @center = [x, y]
    @precisions = (start_precision..end_precision)

    if options[:directory]
      @export_location = options[:directory]
      @mapfile = @export_location + '/mapfile'
      @map = MandelbrotMap.new mapfile: @mapfile
      @map.load
    else
      @export_location = options[:export_location] || 'renders'
      @mapfile = options[:mapfile] || 'renders/mapfile'
    end


    @max_iterations = max_iterations

    if resolutions.nil?
      raise 'Invalid resolutions array'
    elsif resolutions.size == 2 && resolutions[0].class == Integer
      resolutions = [resolutions]
    end

    @resolutions = resolutions
    @scale = options[:scale]
    @override_step = options[:override_step]
  end

  def timestamp
    "[#{Time.now.strftime('%T.%L')}]".magenta
  end

  def precisions=(one_or_more)
    klass = one_or_more.class
    @precisions = if klass == Integer
      [one_or_more]
    elsif klass == Array || klass == Range
      one_or_more
    else
      raise "Invalid precision arguments. Expecting one or more precisions. Got: #{one_or_more}"
    end
  end

  def resolution=(resolution)
    if resolution.nil? || resolution.size != 2
      raise 'Resolution Argument Error.'
    end
    @resolutions = [resolution]
  end

  def resolutions=(resolutions)
    if resolutions.class == Array && resolutions[0] == Integer
      raise "Invalid resolutions arguments. Expecting array of arrays."
    end
    @resolutions = resolutions
  end

  def center=(center)
    if center.class != Array || center.size != 2
      raise "Argument Error: Expected two coordinates #{center}"
    end
    @center = center
  end

  def run(options = {})
    t0 = Time.now
    puts "#{timestamp} " + "Running Batch Render... "

    @resolutions.each do |resolution|
      @precisions.each do |precision|
        puts "#{timestamp} " + "Creating grid..."
        t0 = Time.now

        grid = Grid.new(*@center, precision, *resolution, mapfile: @mapfile, override_step: @override_step)

        grid.map = @map

        grid.compute_mandelbrot @max_iterations
        @map = grid.map
        renderer = Renderer.new(grid)
        renderer.max_iterations = @max_iterations
        renderer.render export_location: @export_location, label: options[:label], prefix: options[:prefix], scale: @scale, color_speed: options[:color_speed]

        t1 = Time.now - t0
        puts "#{timestamp}" + " Render complete".green + " in " + "#{t1.round(3)}".cyan + " seconds."
      end
    end

    t1 = Time.now - t0
    puts "#{timestamp}" + " Batch complete".green + " in " + "#{t1.round(3)}".cyan + " seconds."
    { resolutions: resolutions, precisions: precisions, benchmark: t1 }
  end

end

class ZoomZeroFactory < MandelbrotFactory
  X_COORDINATE = -0.75
  Y_COORDINATE = 0
  ITERATIONS = 2000
  START_PRECISION = 6
  END_PRECISION = 14
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end


class CuspFactory < MandelbrotFactory
  X_COORDINATE = 0.2549870375144766
  Y_COORDINATE = -0.0005679790528465
  ITERATIONS = 1000
  START_PRECISION = 6
  END_PRECISION = 21
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end

class SeahorseFactory < MandelbrotFactory
  X_COORDINATE = -0.7463
  Y_COORDINATE = 0.1102
  ITERATIONS = 1000
  START_PRECISION = 8
  END_PRECISION = 19
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end

class FlowerFactory < MandelbrotFactory
  X_COORDINATE = -0.4170662
  Y_COORDINATE = 0.60295913
  ITERATIONS = 1000
  START_PRECISION = 8
  END_PRECISION = 24
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end

class LightningFactory < MandelbrotFactory
  X_COORDINATE = -1.315180982097868
  Y_COORDINATE = 0.073481649996795
  ITERATIONS = 2000
  START_PRECISION = 6
  END_PRECISION = 50
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end

class PinwheelFactory < MandelbrotFactory
  X_COORDINATE = 0.281717921930775
  Y_COORDINATE = 0.5771052841488505
  ITERATIONS = 4000
  START_PRECISION = 6
  END_PRECISION = 50
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end
