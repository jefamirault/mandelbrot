require 'json'

class MandelbrotMap

  attr_accessor :map, :mapfile

  def initialize(options = {})
    @map = options[:map]
    @mapfile = options[:mapfile]
  end

  def include?(point)
    !!@map[point]
  end

  def get(point)
    @map[point]
  end

  def set(point, iterates_under_two, iterations_explored)
    @map[point] = [iterates_under_two, iterations_explored]
  end
  
  def load(mapfile = @mapfile, options = {})
    if File.file?(mapfile)
      print "#{timestamp}" + " Loading mapfile: " + "#{mapfile}".green
      t0 = Time.now
      File.open(@mapfile) do |f|
        @map = Marshal.load(f)
      end
      t1 = Time.now - t0
      puts " (" + t1.to_s.cyan + " seconds)"

    elsif options[:require_file]
      raise "LoadError: File #{mapfile} not found"
    else
      puts "Creating mapfile: " + "#{mapfile}".cyan + "..."
      File.open mapfile, 'w'
      @map = {}
    end
  end

  def write(options = {})
    if options[:mapfile]
      @mapfile = options[:mapfile]
    end

    print timestamp + " Writing to compressed mapfile: " + "#{@mapfile}".green
    t0 = Time.now
    if options[:overwrite]
      File.open(@mapfile, 'w+') do |f|
        Marshal.dump(@map, f)
      end
    else
      rename = @mapfile + '1'
      puts "Overwrite not enabled, writing to mapfile: " + rename.red
      File.open(rename, 'w+') do |f|
        Marshal.dump(@map, f)
      end
    end
    t1 = Time.now - t0
    puts " (" + "#{t1}".cyan + " seconds)"
  end


  private

  def timestamp
    "[#{Time.now.strftime('%T.%L')}]".magenta
  end
end