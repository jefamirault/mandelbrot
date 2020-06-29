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
    @map = if File.file?(mapfile)
             print "#{timestamp}" + " Loading mapfile: " + "#{mapfile}".green
             JSON.parse(File.open(mapfile).read).to_h
           elsif options[:require_file]
             raise "LoadError: File #{mapfile} not found"
           else
             puts "Creating mapfile: " + "#{mapfile}".cyan + "..."
             File.open mapfile, 'w' do |f|

             end
             {}
           end
  end

  def write(options = {})
    if options[:mapfile]
      @mapfile = options[:mapfile]
    end

    print timestamp + " Writing to mapfile: " + "#{@mapfile}".green
    t0 = Time.now
    if File.file?(@mapfile)
      if options[:overwrite]
        File.write(@mapfile, @map.to_a)
      else
        rename = @mapfile + '1'
        puts "Overwrite not enabled, writing to mapfile: " + rename.red
        File.write(rename, @map.to_a)
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