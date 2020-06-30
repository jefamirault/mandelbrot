require_relative 'grid'
require_relative 'renderer'

class MandelbrotFactory
  attr_accessor :center, :iterations, :precisions, :mapfile, :export_location, :resolutions, :map, :scale

  def initialize(x, y, iterations, start_precision, end_precision, resolutions, options = {})
    @center = [x, y]
    @precisions = (start_precision..end_precision)
    @export_location = options[:export_location] || 'renders'
    @mapfile = options[:mapfile] || 'renders/mapfile.json'
    @iterations = iterations
    if resolutions.nil?
      raise 'Invalid resolutions array'
    elsif resolutions.size == 2 && resolutions[0].class == Integer
      resolutions = [resolutions]
    end

    @resolutions = resolutions
    @scale = options[:scale]
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


  def run(options = {})
    t0 = Time.now
    puts "#{timestamp} " + "Running Batch Render... "

    @resolutions.each do |resolution|
      @precisions.each do |precision|
        puts "#{timestamp} " + "Creating grid..."
        t0 = Time.now

        grid = Grid.new(*@center, precision, *resolution, mapfile: @mapfile)
        grid.map = @map

        grid.compute_mandelbrot @iterations
        @map = grid.map
        renderer = Renderer.new(grid)
        renderer.iterations = @iterations
        renderer.render export_location: @export_location, prefix: options[:prefix], scale: @scale

        t1 = Time.now - t0
        puts "#{timestamp}" + " Render complete".green + " in " + "#{t1.round(3)}".cyan + " seconds.\n\n"
      end
    end

    t1 = Time.now - t0
    puts "#{timestamp}" + " Batch complete".green + " in " + "#{t1.round(3)}".cyan + " seconds.\n\n"
    { resolutions: resolutions, precisions: precisions, benchmark: t1 }
  end

end

class IterationTour < MandelbrotFactory

end

class ZoomZeroFactory < MandelbrotFactory
  X_COORDINATE = -0.75
  Y_COORDINATE = 0
  ITERATIONS = 1000
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
  START_PRECISION = 6
  END_PRECISION = 17
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end

class FlowerFactory < MandelbrotFactory
  X_COORDINATE = -0.4170662
  Y_COORDINATE = 0.60295913
  ITERATIONS = 1000
  START_PRECISION = 6
  END_PRECISION = 24
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end

class SeahorseTailFactory < MandelbrotFactory
  X_COORDINATE = -0.7453
  Y_COORDINATE = 0.1127
  ITERATIONS = 1000
  START_PRECISION = 6
  END_PRECISION = 17
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end

class LightningFactory < MandelbrotFactory
  X_COORDINATE = -1.315180982097868
  Y_COORDINATE = 0.073481649996795
  ITERATIONS = 2000
  START_PRECISION = 6
  END_PRECISION = 56
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end

class PinwheelBladeFactory < MandelbrotFactory
  X_COORDINATE = 0.281717921930775
  Y_COORDINATE = 0.5771052841488505
  ITERATIONS = 4000
  START_PRECISION = 6
  END_PRECISION = 53
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end
