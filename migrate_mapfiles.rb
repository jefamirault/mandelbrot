# Usage:
# ruby migrate_mapfiles.rb mapfile.json mapfile
# => new mapfile format

require_relative 'mandelbrot_map'
require 'colorize'

class MigrateMapfiles
  attr_accessor :old, :new, :map
  def initialize(old_mapfile, new_mapfile)
    @old = old_mapfile
    @new = new_mapfile
    @map = MandelbrotMap.new(mapfile: @old)
  end

  def run
    @map.load_old
    @map.write mapfile: @new, overwrite: true
  end
end

old = ARGV[0]
new = ARGV[1]

puts old
puts new

migrate = MigrateMapfiles.new(old, new)
migrate.run
