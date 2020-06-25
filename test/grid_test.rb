require_relative 'test'
require_relative '../grid'

class GridTest < Test
  def run
    t0 = Time.now
    puts "\nRunning #{self.class}.rb...".cyan

    test_case 'Initialize 16x9 grid centered at (0, 0), step: 0.25, Resolution: 16x9' do
      @grid = Grid.new(0,0,2,16,9)

      test '(0, 0) should be present in the grid' do
        assert_equal @grid.include?(0, 0), true
      end

      test 'Step should be 0.25' do
        assert_equal @grid.step, 0.25
      end

      test 'Top Left Corner should be (-2, 1)' do
        assert_equal @grid.include?(-2, 1), true
        assert_equal @grid.x_min, -2
        assert_equal @grid.y_max, 1
      end

      test 'Bottom Right Corner should be (1.75, -1)' do
        assert_equal @grid.include?(1.75, -1), true
        assert_equal @grid.x_max, 1.75
        assert_equal @grid.y_min, -1
      end
    end

    test_case 'Save to file' do
      mapfile = 'mapfile_test.json'
      width, height = 480, 270
      File.delete(mapfile) if File.file?(mapfile)
      @grid = Grid.new(0,0,7,width,height, mapfile: mapfile)
      @grid.compute_mandelbrot 20

      @grid1 = Grid.new(0,0,7,width,height, mapfile: mapfile)
      @grid1.compute_mandelbrot 20
    end

    t1 = Time.now
    @benchmark = t1 - t0
  end
end

test = GridTest.new
test.run
test.result
