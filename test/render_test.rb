require_relative '../mandelbrot_factory'
require_relative 'test'

class RenderTest < Test
  def run

    t0 = Time.now

    test_resolutions = Renderer::RESOLUTIONS[3..3]

    # SINGLE BATCH TEST
    factory = CuspFactory.new(test_resolutions, export_location: 'renders/test/cusp', mapfile: 'renders/test/cusp/mapfile.json')
    factory.precisions = (6..24)
    run_batch factory
    # ALL BATCHES TEST
    # # batches = [CuspFactory, SeahorseFactory, FlowerFactory, SeahorseTailFactory, LightningFactory, PinwheelBladeFactory].map do |factory|
    # #   factory.new(test_resolutions)
    # # end
    #
    # puts "Running #{batches.size} Render Tests..."
    #
    # batches.each do |batch|
    #   run_batch batch
    # end

    t1 = Time.now - t0
    puts "Render Tests complete".green + " in " + "#{t1.round(3)}".cyan + " seconds.\n\n"
  end

  def run_batch(factory, name = nil)
    t0 = Time.now
    puts "Running Render Test Batch: #{name}"

    factory.run

    t1 = Time.now - t0
    puts "Batch complete".green + " in " + "#{t1.round(3)}".cyan + " seconds.\n\n"
  end

end

test = RenderTest.new
test.run

# Seahorse
# x = -0.7463
# y = 0.1102
# width, height = 7680, 4320
# iterations = 1000
# # (6..21).each do |precision|
# (21..21).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/seahorse/mapfile2.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render 3
# end

# Flower
# x, y = -0.4170662, 0.60295913
# iterations = 1000
# width, height = 960, 540
# (8..38).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/flower/mapfile3.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end

# Seahorse Tail
# x = -0.7453
# y = 0.1127
# width, height = 240, 135
# iterations = 500
# (6..21).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/seahorse_tail/mapfile4.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end

# Lightning
# x = -1.315180982097868
# y = 0.073481649996795
# width, height = 240, 135
# iterations = 500
# (6..30).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/lightning/mapfile5.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end

# Pinwheel Blade
# x = 0.281717921930775
# y = 0.5771052841488505
# width, height = 240, 135
# iterations = 1000
# (6..50).each do |precision|
#   grid = Grid.new(x, y, precision, width, height, mapfile: 'renders/test/pinwheel_blade/mapfile6.json')
#   grid.compute_mandelbrot iterations
#   Renderer.new(grid).render
# end
#