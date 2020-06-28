require_relative '../mandelbrot_factory'
require_relative 'test'

class RenderTest < Test
  def run

    t0 = Time.now


    # SINGLE BATCH TEST
    # test_resolutions = Renderer::RESOLUTIONS[4..5]
    # factory = CuspFactory.new(test_resolutions, export_location: 'renders/test/cusp', mapfile: 'renders/test/cusp/mapfile99.json')
    #
    #
    # test_resolutions = Renderer::RESOLUTIONS[6..6]
    # factory.resolutions = test_resolutions
    # factory.precisions = (4..4)
    # # run_batch factory
    #
    # test_resolutions = Renderer::RESOLUTIONS[7..8]
    # factory.resolutions = test_resolutions
    # factory.precisions = (5..5)
    # # run_batch factory
    #
    # test_resolutions = Renderer::RESOLUTIONS[9..10]
    # factory.resolutions = test_resolutions
    # factory.precisions = (6..6)
    # # run_batch factory
    #
    # test_resolutions = Renderer::RESOLUTIONS[11..12]
    # factory.resolutions = test_resolutions
    # factory.precisions = (7..7)
    # # run_batch factory
    #
    #
    # test_resolutions = Renderer::RESOLUTIONS[13..14] # 1080p
    # factory.resolutions = test_resolutions
    # factory.precisions = (8..8)
    # # run_batch factory
    #
    # test_resolutions = Renderer::RESOLUTIONS[15..15] # 4K
    # factory.resolutions = test_resolutions
    # factory.precisions = (8..8)
    # # run_batch factory



    # ALL BATCHES TEST
    # test_resolutions = Renderer::RESOLUTIONS[5]
    # batches = [CuspFactory, SeahorseFactory, FlowerFactory, SeahorseTailFactory, LightningFactory, PinwheelBladeFactory].map do |factory|
    #   factory.new(test_resolutions)
    # end

    test_resolutions = Renderer::RESOLUTIONS[6..7]

    puts "Running Render Tests..."

    def all(test_resolutions)
      cusp = CuspFactory.new(test_resolutions, export_location: 'renders/test/cusp', mapfile: 'renders/test/cusp/mapfile.json')
      # run_batch cusp

      lightning = LightningFactory.new test_resolutions, export_location: 'renders/test/lightning', mapfile: 'renders/test/lightning/mapfile.json'
      # run_batch lightning

      seahorse = SeahorseFactory.new test_resolutions, export_location: 'renders/test/seahorse', mapfile: 'renders/test/seahorse/mapfile.json'
      # run_batch seahorse

      flower = FlowerFactory.new test_resolutions, export_location: 'renders/test/flower', mapfile: 'renders/test/flower/mapfile.json'
      run_batch flower

      seahorse_tail = SeahorseTailFactory.new test_resolutions, export_location: 'renders/test/seahorse_tail', mapfile: 'renders/test/seahorse_tail/mapfile.json'
      # run_batch seahorse_tail

      pinwheel_blade = PinwheelBladeFactory.new test_resolutions, export_location: 'renders/test/pinwheel_blade', mapfile: 'renders/test/pinwheel_blade/mapfile.json'
      # run_batch pinwheel_blade
    end

    test_resolutions = Renderer::RESOLUTIONS[6..7]
    # all(test_resolutions)
    test_resolutions = Renderer::RESOLUTIONS[8..9]
    # all(test_resolutions)
    test_resolutions = Renderer::RESOLUTIONS[10..10]
    all(test_resolutions)
    test_resolutions = Renderer::RESOLUTIONS[12..13]
    # all(test_resolutions)
    test_resolutions = Renderer::RESOLUTIONS[14]
    # all(test_resolutions)


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
