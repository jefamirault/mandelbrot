require_relative '../lib/factory/ot_factory'
require 'simple_test'
require 'fileutils'

class RenderTest < SimpleTest
  def run(options = {})

    # options[:color_speed] = 12

    puts "Running Render Tests..."
    t0 = Time.now

    def all(options = {})
      folder = 'renders/test/cusp'
      purge_folder folder
      # options[:test] = true # Desired API for purging folder before rendering
      options[:directory] = folder
      cusp = CuspFactory.new options
      cusp.run
      cusp.map.write overwrite: true
      # cusp.update_map # Desired API updating map

      folder = 'renders/test/lightning'
      purge_folder folder
      options[:directory] = folder
      lightning = LightningFactory.new options
      lightning.run
      lightning.map.write overwrite: true

      folder = 'renders/test/seahorse'
      purge_folder folder
      options[:directory] = folder
      seahorse = SeahorseFactory.new options
      seahorse.run
      seahorse.map.write overwrite: true

      folder = 'renders/test/flower'
      purge_folder folder
      options[:directory] = folder
      flower = FlowerFactory.new options
      flower.run
      flower.map.write overwrite: true

      folder = 'renders/test/pinwheel'
      purge_folder folder
      options[:directory] = folder
      pinwheel = PinwheelFactory.new options
      pinwheel.run
      pinwheel.map.write overwrite: true
    end

    # Render Batch Test

    resolution = if options[:fast]
                   # ~2-3 seconds
                   Renderer::RESOLUTIONS[5]
                 elsif options[:slow]
                   # ~1 minute
                   Renderer::RESOLUTIONS[9]
                 else
                   # ~10-15 seconds
                   Renderer::RESOLUTIONS[7]
                 end
    all(resolution: resolution)

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
