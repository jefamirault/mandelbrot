require_relative 'grid'
require_relative 'renderer'

class MandelbrotFactory
  attr_accessor :center, :iterations, :precisions, :mapfile, :export_location, :resolutions

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
  end

  def timestamp
    "[#{Time.now.strftime('%T.%L')}]".magenta
  end

  def run(prefix = nil)
    t0 = Time.now
    puts "#{timestamp} " + "Running Batch Render... "

    @resolutions.each do |resolution|
      precisions.each do |precision|
        puts "#{timestamp} " + "Creating grid..."
        t0 = Time.now
        grid = Grid.new(*@center, precision, *resolution, mapfile: @mapfile)
        grid.compute_mandelbrot @iterations
        Renderer.new(grid).render export_location: @export_location, prefix: prefix

        t1 = Time.now - t0
        puts "#{timestamp}" + " Render complete".green + " in " + "#{t1.round(3)}".cyan + " seconds.\n\n"
      end
    end
    t1 = Time.now - t0
    puts "#{timestamp}" + " Batch complete".green + " in " + "#{t1.round(3)}".cyan + " seconds.\n\n"
    { resolutions: resolutions, precisions: precisions, benchmark: t1 }
  end
end

class ZoomedOutFactory < MandelbrotFactory
  X_COORDINATE = 0
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
  END_PRECISION = 16
  def initialize(resolutions, options = {})
    super(X_COORDINATE, Y_COORDINATE, ITERATIONS, START_PRECISION, END_PRECISION, resolutions, options)
  end
end

class FlowerFactory < MandelbrotFactory
  X_COORDINATE = -0.4170662
  Y_COORDINATE = 0.60295913
  ITERATIONS = 1000
  START_PRECISION = 6
  END_PRECISION = 27
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
