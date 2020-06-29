require_relative '../mandelbrot_factory'
require_relative 'test'

class RenderTest < Test
  def run



    # ALL BATCHES TEST

    puts "Running Render Tests..."
    t0 = Time.now

    def all(test_resolutions)
      # zoom_zero = ZoomZeroFactory.new test_resolutions, export_location: 'renders/test/zoom_zero', mapfile: 'renders/test/zoom_zero/mapfile.json'
      # zoom_zero.iterations = 100
      # zoom_zero.precisions = (7..7)
      # run_batch zoom_zero

      cusp = CuspFactory.new test_resolutions, export_location: 'renders/test/cusp'
      cusp.map = MandelbrotMap.new mapfile: 'renders/test/cusp/mapfile.json'
      cusp.map.load
      cusp.run
      cusp.map.write overwrite: true

      lightning = LightningFactory.new test_resolutions, export_location: 'renders/test/lightning'
      lightning.map = MandelbrotMap.new mapfile: 'renders/test/lightning/mapfile.json'
      lightning.map.load
      lightning.run
      lightning.map.write overwrite: true


      seahorse = SeahorseFactory.new test_resolutions, export_location: 'renders/test/seahorse'
      seahorse.map = MandelbrotMap.new mapfile: 'renders/test/seahorse/mapfile.json'
      seahorse.map.load
      seahorse.run
      seahorse.map.write overwrite: true


      flower = FlowerFactory.new test_resolutions, export_location: 'renders/test/flower'
      flower.map = MandelbrotMap.new mapfile: 'renders/test/flower/mapfile.json'
      flower.map.load
      flower.run
      flower.map.write overwrite: true


      seahorse_tail = SeahorseTailFactory.new test_resolutions, export_location: 'renders/test/seahorse_tail'
      seahorse_tail.map = MandelbrotMap.new mapfile: 'renders/test/seahorse_tail/mapfile.json'
      seahorse_tail.map.load
      seahorse_tail.run
      seahorse_tail.map.write overwrite: true


      pinwheel_blade = PinwheelBladeFactory.new test_resolutions, export_location: 'renders/test/pinwheel_blade'
      pinwheel_blade.map = MandelbrotMap.new mapfile: 'renders/test/pinwheel_blade/mapfile.json'
      pinwheel_blade.map.load
      pinwheel_blade.run
      pinwheel_blade.map.write overwrite: true
    end

    # Quick Render Batch Test
    test_resolutions = Renderer::RESOLUTIONS[4..4]
    # all(test_resolutions)

    # Bigger Slower Test
    test_resolutions = Renderer::RESOLUTIONS[7..7] # 144x81
    # all(test_resolutions)
    test_resolutions = Renderer::RESOLUTIONS[8..8]
    # all(test_resolutions)
    test_resolutions = Renderer::RESOLUTIONS[10..11]
    # all(test_resolutions)
    test_resolutions = Renderer::RESOLUTIONS[12..13]
    # all(test_resolutions)
    test_resolutions = Renderer::RESOLUTIONS[14] # 1920x1080
    # all(test_resolutions)
    test_resolutions = Renderer::RESOLUTIONS[15] # 2560x1440
    # all(test_resolutions)


    # Zoom Zero Hi Res

    zoom_zero = ZoomZeroFactory.new [[64, 60]], export_location: 'renders/test/zoom_zero'
    zoom_zero.map = MandelbrotMap.new mapfile: 'renders/test/zoom_zero/mapfile.json'
    zoom_zero.map.load
    zoom_zero.iterations = 100
    zoom_zero.precisions = (4..4)
    run_batch zoom_zero

    zoom_zero.resolutions = [[150, 140]]
    zoom_zero.precisions = (5..5)
    run_batch zoom_zero

    zoom_zero.resolutions = [[270, 250]]
    zoom_zero.precisions = (6..6)
    run_batch zoom_zero

    zoom_zero.resolutions = [[540, 480]]
    zoom_zero.precisions = (7..7)
    run_batch zoom_zero

    # zoom_zero.resolutions = [[1400, 1200]]
    # zoom_zero.precisions = (8..8)
    # run_batch zoom_zero

    # zoom_zero.resolutions = [[2800, 2400]]
    # zoom_zero.precisions = (9..9)
    # run_batch zoom_zero

    zoom_zero.map.write overwrite: true


    # Iteration Tour

    # factory = ZoomZeroFactory.new [[150, 150]], export_location: 'renders/test/iterations' #, mapfile: "renders/test/iterations/mapfile.json"
    #
    # map = MandelbrotMap.new mapfile: "renders/test/iterations/mapfile.json"
    # map.load
    #
    # factory.map = map
    #
    # factory.precisions = (4..4)
    # (1..3).each do |iteration|
    #   factory.iterations = iteration
    #   factory.run
    # end
    #
    # factory.center = [-0.63, 0]
    # factory.run
    #
    # factory.precisions = (5..5)
    # (3..6).each do |iteration|
    #   factory.iterations = iteration
    #   factory.run
    # end
    #
    # factory.resolutions = [[320, 300]]
    # factory.run
    #
    # factory.precisions = (6..6)
    # (6..8).each do |iteration|
    #   factory.iterations = iteration
    #   factory.run
    # end
    #
    # factory.resolutions = [[600, 570]]
    # factory.run
    #
    # factory.precisions = (7..7)
    # (8..10).each do |iteration|
    #   factory.iterations = iteration
    #   factory.run
    # end
    #
    # factory.resolutions = [[1300, 1150]]
    # factory.run
    #
    # factory.precisions = (8..8)
    # factory.iterations = 10
    # factory.run
    #
    # factory.center = [-0.7, 0]
    # factory.run
    #
    # (11..20).each do |iteration|
    #   factory.iterations = iteration
    #   factory.run
    # end
    #
    # factory.resolutions = [[2600, 2300]]
    # factory.precisions = (9..9)
    #
    # (11..20).each do |iteration|
    #   factory.iterations = iteration
    #   factory.run
    # end
    #
    #
    # (21..30).each do |iteration|
    #   factory.iterations = iteration
    #   factory.run
    # end
    #
    # map.write overwrite: true

    t1 = Time.now - t0
    puts "#{timestamp}" + " Render Tests complete".green + " in " + "#{t1.round(3)}".cyan + " seconds.\n\n\n"
  end

  def run_batch(factory, name = nil)
    t0 = Time.now

    factory.run

    t1 = Time.now - t0
  end

  private

  def timestamp
    "[#{Time.now.strftime('%T.%L')}]".magenta
  end
end

test = RenderTest.new
test.run
