require_relative '../mandelbrot_factory'
require 'simple_test'
require 'fileutils'

class RenderTest < SimpleTest
  def run(options = {})

    # ALL BATCHES TEST

    options[:color_speed] = 10

    puts "Running Render Tests..."
    t0 = Time.now

    def all(test_resolutions, options = {})
      # folder = 'renders/test/cusp'
      # # purge_folder folder
      # cusp = CuspFactory.new test_resolutions, export_location: folder
      # cusp.map = MandelbrotMap.new mapfile: "#{folder}/mapfile"
      # cusp.map.load
      # cusp.run options
      # cusp.map.write overwrite: true
      #
      # folder = 'renders/test/lightning'
      # # purge_folder folder
      # lightning = LightningFactory.new test_resolutions, export_location: folder
      # lightning.map = MandelbrotMap.new mapfile: "#{folder}/mapfile"
      # lightning.map.load
      # lightning.run options
      # lightning.map.write overwrite: true

      # folder = 'renders/test/seahorse'
      # # purge_folder folder
      # seahorse = SeahorseFactory.new test_resolutions, export_location: folder
      # seahorse.map = MandelbrotMap.new mapfile: "#{folder}/mapfile"
      # seahorse.map.load
      # seahorse.run options
      # seahorse.map.write overwrite: true

      # folder = 'renders/test/flower'
      # # purge_folder folder
      # flower = FlowerFactory.new test_resolutions, export_location: folder
      # flower.map = MandelbrotMap.new mapfile: "#{folder}/mapfile"
      # flower.map.load
      # flower.run options
      # flower.map.write overwrite: true
      #
      # folder = 'renders/test/seahorse_tail'
      # # purge_folder folder
      # seahorse_tail = SeahorseTailFactory.new test_resolutions, export_location: folder
      # seahorse_tail.map = MandelbrotMap.new mapfile: "#{folder}/mapfile"
      # seahorse_tail.map.load
      # seahorse_tail.run options
      # seahorse_tail.map.write overwrite: true
      #
      folder = 'renders/test/pinwheel'
      # purge_folder folder
      pinwheel = PinwheelFactory.new test_resolutions, export_location: folder
      pinwheel.map = MandelbrotMap.new mapfile: "#{folder}/mapfile"
      pinwheel.map.load
      pinwheel.run options
      pinwheel.map.write overwrite: true
    end

    # Render Batch Test

    test_resolutions = if options[:fast]
                         Renderer::RESOLUTIONS[3]
                       elsif options[:slow]
                         # Renderer::RESOLUTIONS[5..10]
                         Renderer::RESOLUTIONS[14] # 1080p
                       else
                         Renderer::RESOLUTIONS[4..5]
                       end
    all(test_resolutions)


    t1 = Time.now - t0
    puts "#{timestamp}" + " Render Tests complete".green + " in " + "#{t1.round(3)}".cyan + " seconds."
  end

  private

  def timestamp
    "[#{Time.now.strftime('%T.%L')}]".magenta
  end
end

test = RenderTest.new

options = {}

if ARGV[0] == 'fast'
  options[:fast] = true
elsif ARGV[0] == 'slow'
  options[:slow] = true
end

test.run options
