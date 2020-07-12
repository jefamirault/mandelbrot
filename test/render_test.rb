require_relative '../mandelbrot_factory'
require 'simple_test'
require 'fileutils'

class RenderTest < SimpleTest
  def run(options = {})

    # options[:color_speed] = 12

    puts "Running Render Tests..."
    t0 = Time.now

    def all(test_resolutions, options = {})
      folder = 'renders/test/cusp'
      purge_folder folder
      cusp = CuspFactory.new test_resolutions, directory: folder
      cusp.run options
      cusp.map.write overwrite: true

      folder = 'renders/test/lightning'
      purge_folder folder
      lightning = LightningFactory.new test_resolutions, directory: folder
      lightning.run options
      lightning.map.write overwrite: true

      folder = 'renders/test/seahorse'
      purge_folder folder
      seahorse = SeahorseFactory.new test_resolutions, directory: folder
      seahorse.run options
      seahorse.map.write overwrite: true

      folder = 'renders/test/flower'
      purge_folder folder
      flower = FlowerFactory.new test_resolutions, directory: folder
      flower.run options
      flower.map.write overwrite: true

      folder = 'renders/test/pinwheel'
      # purge_folder folder
      pinwheel = PinwheelFactory.new test_resolutions, directory: folder
      # pinwheel.scale = 10
      pinwheel.run options
      pinwheel.map.write overwrite: true
    end

    # Render Batch Test

    test_resolutions = if options[:fast]
                         Renderer::RESOLUTIONS[3]
                       elsif options[:slow]
                         # Renderer::RESOLUTIONS[5..10]
                         Renderer::RESOLUTIONS[8] # 1080p
                       else
                         Renderer::RESOLUTIONS[5]
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
