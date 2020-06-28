require_relative '../mandelbrot_factory'
require_relative 'test'

class RenderTest < Test
  def run



    # ALL BATCHES TEST

    puts "Running Render Tests..."
    t0 = Time.now

    def all(test_resolutions)
      zoom_zero = ZoomZeroFactory.new test_resolutions, export_location: 'renders/test/zoom_zero', mapfile: 'renders/test/zoom_zero/mapfile.json'
      zoom_zero.iterations = 100
      zoom_zero.precisions = (7..7)
      # run_batch zoom_zero

      cusp = CuspFactory.new test_resolutions, export_location: 'renders/test/cusp', mapfile: 'renders/test/cusp/mapfile.json'
      # run_batch cusp

      lightning = LightningFactory.new test_resolutions, export_location: 'renders/test/lightning', mapfile: 'renders/test/lightning/mapfile.json'
      # run_batch lightning

      seahorse = SeahorseFactory.new test_resolutions, export_location: 'renders/test/seahorse', mapfile: 'renders/test/seahorse/mapfile.json'
      # run_batch seahorse

      flower = FlowerFactory.new test_resolutions, export_location: 'renders/test/flower', mapfile: 'renders/test/flower/mapfile.json'
      # run_batch flower

      seahorse_tail = SeahorseTailFactory.new test_resolutions, export_location: 'renders/test/seahorse_tail', mapfile: 'renders/test/seahorse_tail/mapfile.json'
      # run_batch seahorse_tail

      pinwheel_blade = PinwheelBladeFactory.new test_resolutions, export_location: 'renders/test/pinwheel_blade', mapfile: 'renders/test/pinwheel_blade/mapfile.json'
      # run_batch pinwheel_blade
    end

    # test_resolutions = Renderer::RESOLUTIONS[7..7] # 144x81
    # all(test_resolutions)
    # test_resolutions = Renderer::RESOLUTIONS[8..9]
    # all(test_resolutions)
    # test_resolutions = Renderer::RESOLUTIONS[10..11]
    # all(test_resolutions)
    # test_resolutions = Renderer::RESOLUTIONS[12..13]
    # all(test_resolutions)
    # test_resolutions = Renderer::RESOLUTIONS[14] # 1920x1080
    # all(test_resolutions)
    # test_resolutions = Renderer::RESOLUTIONS[15] # 2560x1440
    # all(test_resolutions)


    # Single Tests
    zoom_zero = ZoomZeroFactory.new Renderer::RESOLUTIONS[7..7], export_location: 'renders/test/zoom_zero', mapfile: 'renders/test/zoom_zero/mapfile.json'
    zoom_zero.iterations = 100
    zoom_zero.precisions = (4..4)
    zoom_zero.load_mapfile

    run_batch zoom_zero

    zoom_zero.resolutions = Renderer::RESOLUTIONS[10..10]
    zoom_zero.precisions = (6..6)
    run_batch zoom_zero

    # zoom_zero.resolutions = Renderer::RESOLUTIONS[11..11]
    # zoom_zero.precisions = (7..7)
    # run_batch zoom_zero

    zoom_zero.resolutions = Renderer::RESOLUTIONS[12..12] # 960x540
    zoom_zero.precisions = (7..7)
    run_batch zoom_zero

    zoom_zero.resolutions = Renderer::RESOLUTIONS[13..13] # 1280x720
    zoom_zero.precisions = (8..8)
    run_batch zoom_zero

    zoom_zero.write_mapfile


    def cusp_test
      test_resolutions = Renderer::RESOLUTIONS[5..5]
      factory = CuspFactory.new(test_resolutions, export_location: 'renders/test/cusp', mapfile: 'renders/test/cusp/mapfile99.json')
      factory.resolutions = test_resolutions
      factory.precisions = (5..5)
      run_batch factory
    end


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
