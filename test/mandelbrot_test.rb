require_relative 'test'
require_relative '../mandelbrot'


class MandelbrotTest < Test
  def run
    t0 = Time.now
    puts "\nRunning #{self.class}.rb...".cyan

    test_case 'Initialize complex number 0 + 0i' do
      @complex = Complex(0, 0)
      check = Mandelbrot.new(@complex, 20)

      test '0 should be part of the Mandelbrot Set' do
        assert_equal check.member?, true
      end

      test '0 should have 20 iterates under 2 after 20 iterations' do
        assert_equal check.iterates_under_two, 20
      end
    end

    test_case 'Initialize complex number 1 + 0i' do
      @complex = Complex(1, 0)
      check = Mandelbrot.new(@complex)

      test '1 should not be part of the mandelbrot set' do
        assert_equal check.member?, false
      end
      test '1 should have 1 iterate under 2' do
        assert_equal check.iterates_under_two, 1
      end
    end

    test_case 'High Precision Test' do


    end



    t1 = Time.now
    @benchmark = t1 - t0
  end
end


test = MandelbrotTest.new
test.run
test.result
