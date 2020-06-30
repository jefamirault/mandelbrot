require_relative '../mandelbrot_factory'
require_relative 'test'
require 'fileutils'

class RenderTest < Test
  def run(options = {})

    # ALL BATCHES TEST

    puts "Running Render Tests..."
    t0 = Time.now

    def all(test_resolutions)
      folder = 'renders/test/cusp'
      purge_folder folder
      cusp = CuspFactory.new test_resolutions, export_location: folder
      cusp.map = MandelbrotMap.new mapfile: "#{folder}/mapfile.json"
      cusp.map.load
      cusp.run
      cusp.map.write overwrite: true

      folder = 'renders/test/lightning'
      purge_folder folder
      lightning = LightningFactory.new test_resolutions, export_location: folder
      lightning.map = MandelbrotMap.new mapfile: "#{folder}/mapfile.json"
      lightning.map.load
      lightning.run
      lightning.map.write overwrite: true

      folder = 'renders/test/seahorse'
      purge_folder folder
      seahorse = SeahorseFactory.new test_resolutions, export_location: folder
      seahorse.map = MandelbrotMap.new mapfile: "#{folder}/mapfile.json"
      seahorse.map.load
      seahorse.run
      seahorse.map.write overwrite: true

      folder = 'renders/test/flower'
      purge_folder folder
      flower = FlowerFactory.new test_resolutions, export_location: folder
      flower.map = MandelbrotMap.new mapfile: "#{folder}/mapfile.json"
      flower.map.load
      flower.run
      flower.map.write overwrite: true

      folder = 'renders/test/seahorse_tail'
      purge_folder folder
      seahorse_tail = SeahorseTailFactory.new test_resolutions, export_location: folder
      seahorse_tail.map = MandelbrotMap.new mapfile: "#{folder}/mapfile.json"
      seahorse_tail.map.load
      seahorse_tail.run
      seahorse_tail.map.write overwrite: true

      folder = 'renders/test/pinwheel_blade'
      purge_folder folder
      pinwheel_blade = PinwheelBladeFactory.new test_resolutions, export_location: folder
      pinwheel_blade.map = MandelbrotMap.new mapfile: "#{folder}/mapfile.json"
      pinwheel_blade.map.load
      pinwheel_blade.run
      pinwheel_blade.map.write overwrite: true
    end

    # Quick Render Batch Test

    test_resolutions = if options[:fast]
                         Renderer::RESOLUTIONS[3]
                       elsif options[:slow]
                         Renderer::RESOLUTIONS[5..10]
                       else
                         Renderer::RESOLUTIONS[4..5]
                       end
    all(test_resolutions)


    # Zoom Zero Hi Res

    factory_parameters = [
        {
            precision: 3,
            resolution: [34, 31],
            scale: 32
        },
        {
            precision: 4,
            resolution: [68, 63],
            scale: 16
        },
        {
            precision: 5,
            resolution: [136, 126],
            scale: 8 },
        {
            precision: 6,
            resolution: [270, 250],
            scale: 4
        },
        {
            precision: 7,
            resolution: [540, 480],
            scale: 2
        },
        {
            precision: 8,
            resolution: [1400, 1200],
            scale: 1
        },
        {
            precision: 9,
            resolution: [2800, 2400],
            scale: 1
        }
    ]

    purge_folder folder = 'renders/test/zoom_zero'
    zoom_zero = ZoomZeroFactory.new [[64, 60]], export_location: folder
    zoom_zero.map = MandelbrotMap.new mapfile: "#{folder}/mapfile.json"
    zoom_zero.map.load

    zoom_zero.iterations = if options[:fast]
                             50
                           elsif options[:slow]
                             500
                           else
                             100
                           end

    # fast
    factory_parameters[0..2].each do |params|
      zoom_zero.scale = params[:scale]
      zoom_zero.precisions = params[:precision]
      zoom_zero.resolution = params[:resolution]
      zoom_zero.run
    end

    # medium
    unless options[:fast]
      factory_parameters[3..4].each do |params|
        zoom_zero.scale = params[:scale]
        zoom_zero.precisions = params[:precision]
        zoom_zero.resolution = params[:resolution]
        zoom_zero.run
      end
    end

    # slow
    if options[:slow]
      factory_parameters[5..6].each do |params|
        zoom_zero.scale = params[:scale]
        zoom_zero.precisions = params[:precision]
        zoom_zero.resolution = params[:resolution]
        zoom_zero.run
      end
    end

    zoom_zero.map.write overwrite: true


    # Iteration Tour

    purge_folder folder = 'renders/test/iterations'
    factory = ZoomZeroFactory.new [[100, 100]], export_location: folder
    map = MandelbrotMap.new mapfile: "#{folder}/mapfile.json"
    map.load
    factory.map = map

    factory.center = [0, 0]

    factory.precisions = (4..4)
    factory.scale = 32
    (1..3).each do |iteration|
      factory.iterations = iteration
      factory.run
    end

    factory.center = [-0.63, 0]
    factory.run

    factory.resolution = [250, 237]
    factory.scale = 16
    factory.precisions = [5]
    factory.run

    factory.scale = 16
    factory.resolution = [160, 150]
    factory.precisions = (5..5)
    (3..5).each do |iteration|
      factory.iterations = iteration
      factory.run
    end

    unless options[:fast]
      factory.resolutions = [[320, 300]]
      factory.scale = 8

      factory.precisions = (6..6)
      (5..8).each do |iteration|
        factory.iterations = iteration
        factory.run
      end

      factory.resolutions = [[600, 570]]
      factory.scale = 4

      factory.precisions = (7..7)
      (8..11).each do |iteration|
        factory.iterations = iteration
        factory.run
      end

      if options[:slow]

        factory.resolutions = [[1300, 1150]]
        factory.scale = 2
        factory.precisions = [8]
        factory.run

        factory.center = [-0.7, 0]
        factory.precisions = (8..8)
        factory.iterations = 12
        factory.run

        (13..25).each do |iteration|
          factory.iterations = iteration
          factory.run
        end

        factory.resolutions = [[2600, 2300]]
        factory.precisions = (9..9)
        factory.scale = 1

        [25, 50, 100, 1000].each do |iteration|
          factory.iterations = iteration
          factory.run
        end
      end

    end

    map.write overwrite: true

    t1 = Time.now - t0
    puts "#{timestamp}" + " Render Tests complete".green + " in " + "#{t1.round(3)}".cyan + " seconds.\n\n\n"
  end

  private

  def timestamp
    "[#{Time.now.strftime('%T.%L')}]".magenta
  end
end

test = RenderTest.new

# test.run slow: true
# test.run
test.run fast: true
