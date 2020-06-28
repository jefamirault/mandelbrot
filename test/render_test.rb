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
    #
    # Zoom Zero Hi Res
    # zoom_zero = ZoomZeroFactory.new [[64, 64]], export_location: 'renders/test/zoom_zero', mapfile: 'renders/test/zoom_zero/mapfile.json'
    # zoom_zero.iterations = 6
    # zoom_zero.precisions = (4..4)
    # zoom_zero.load_mapfile
    # run_batch zoom_zero
    #
    # zoom_zero.resolutions = [[150, 150]]
    # zoom_zero.precisions = (5..5)
    # run_batch zoom_zero
    #
    # zoom_zero.resolutions = [[270, 270]]
    # zoom_zero.precisions = (6..6)
    # run_batch zoom_zero
    #
    # zoom_zero.resolutions = [[540, 540]]
    # zoom_zero.precisions = (7..7)
    # run_batch zoom_zero

    # zoom_zero.resolutions = [[1400, 1200]]
    # zoom_zero.precisions = (8..8)
    # run_batch zoom_zero

    # zoom_zero.resolutions = [[2800, 2400]]
    # zoom_zero.precisions = (9..9)
    # run_batch zoom_zero

    # zoom_zero.write_mapfile


    # Iteration Tour

    factory = ZoomZeroFactory.new [[150, 150]], export_location: 'renders/test/zoom_zero' #, mapfile: "renders/test/zoom_zero/mapfile#{iteration}.json"

    factory.center = [0, 0]
    factory.precisions = (4..4)
    (1..3).each do |iteration|
      factory.iterations = iteration
      # zoom_zero.run
    end

    factory.center = [-0.63, 0]
    # zoom_zero.run

    factory.precisions = (5..5)
    (3..6).each do |iteration|
      factory.iterations = iteration
      # zoom_zero.run
    end

    factory.resolutions = [[320, 300]]
    # zoom_zero.run

    factory.precisions = (6..6)
    (6..8).each do |iteration|
      factory.iterations = iteration
      # zoom_zero.run
    end

    factory.resolutions = [[600, 570]]
    # zoom_zero.run

    factory.precisions = (7..7)
    (8..10).each do |iteration|
      factory.iterations = iteration
      # zoom_zero.run
    end

    factory.resolutions = [[1300, 1150]]
    # zoom_zero.run

    factory.precisions = (8..8)
    factory.iterations = 10
    # zoom_zero.run

    factory.center = [-0.7, 0]
    # zoom_zero.run

    (11..20).each do |iteration|
      factory.iterations = iteration
      # zoom_zero.run
    end

    factory.resolutions = [[2600, 2300]]
    factory.precisions = (9..9)

    (11..20).each do |iteration|
      factory.iterations = iteration
      factory.run
    end


    [15, 25, 40, 60, 100]


    t1 = Time.now - t0
    puts "#{timestamp}" + " Render Tests complete".green + " in " + "#{t1.round(3)}".cyan + " seconds.\n\n\n"
  end

  # def run_batch(factory, name = nil)
  #   t0 = Time.now
  #
  #   factory.run
  #
  #   t1 = Time.now - t0
  # end

  private

  def timestamp
    "[#{Time.now.strftime('%T.%L')}]".magenta
  end
end

test = RenderTest.new
test.run
