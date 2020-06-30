require 'simple_test'
require_relative '../grid'

class GridTest < SimpleTest
  def run
    t0 = Time.now
    puts "\nRunning #{self.class}.rb...".cyan

    test_case 'Initialize 20x20 grid centered at (0, 0), step: 0.25, Resolution: 10x10' do
      @grid = Grid.new(0,0,2,20,20)

      test '(0, 0) should be present in the grid' do
        assert_equal @grid.include?(0, 0), true
      end

      test 'Step should be 0.2' do
        assert_equal @grid.step, 0.2
      end

      test 'Top Left Corner should be (-2, 1)' do
        assert_equal @grid.include?(-2, 1), true
        assert_equal @grid.x_min, -2
        assert_equal @grid.y_max, 1.8
      end

      test 'Bottom Right Corner should be (1.8, -2)' do
        assert_equal @grid.include?(1.8, -2), true
        assert_equal @grid.x_max, 1.8
        assert_equal @grid.y_min, -2
      end
    end

    test_case 'Computing identical grids using the same map' do
      mapfile = 'renders/test/mapfile.json'
      width, height = 16, 9
      precision = 7
      iterations = 10
      x, y = 0, 0
      File.delete(mapfile) if File.file?(mapfile)

      total_points = width * height

      @grid = Grid.new(x, y, precision, width, height, mapfile: mapfile)
      @grid.map = MandelbrotMap.new mapfile: mapfile
      @grid.map.load

      new_points = @grid.compute_mandelbrot(iterations)[:new_points]

      assert_equal new_points, total_points

      @grid1 = Grid.new(x, y, precision, width, height, mapfile: mapfile)
      @grid1.map = @grid.map

      reused_points = @grid1.compute_mandelbrot(iterations)[:reused]

      test 'Calculating the same region twice should reuse all points the second time.' do
        assert_equal reused_points, total_points
      end

      @grid.map.write overwrite: true

      grid3 = Grid.new(x,y, precision, width, height)
      grid3.map = MandelbrotMap.new mapfile: mapfile
      grid3.map.load

      reused_points = @grid1.compute_mandelbrot(iterations)[:reused]

      test 'After loading from mapfile, Calculating the same region twice should reuse all points the second time.' do
        assert_equal reused_points, total_points
      end

    end


    t1 = Time.now
    @benchmark = t1 - t0
  end
end
#
# test = GridTest.new
# test.run
# test.result
