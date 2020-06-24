require_relative 'test'
require_relative '../complex_number'

class ComplexNumberTest < Test
  def run
    t0 = Time.now
    puts "\nRunning #{self.class}.rb...".cyan
    test_case 'Initialize Complex Number to (0, 0)' do
      @complex_number = ComplexNumber(0, 0)

      test 'Real Component should be 0' do
        assert_equal @complex_number.a, 0
      end

      test 'Imaginary Component should be 0' do
        assert_equal @complex_number.b, 0
      end

      test 'Magnitude should be 0' do
        assert_equal @complex_number.magnitude, 0
      end
    end

    test_case 'Initialize Complex Number: 3 + 4i' do
      @complex_number = ComplexNumber(3,4)

      test 'Real Component should be 3' do
        assert_equal @complex_number.a, 3
      end

      test 'Imaginary Component should be 4' do
        assert_equal @complex_number.b, 4
      end

      test 'Magnitude should be 5' do
        assert_equal @complex_number.magnitude, 5
      end
    end

    test_case 'Calculate the square of 3 + 4i' do
      @complex_number = ComplexNumber(3,4)

      test '(3 + 4i)^2 should equal (==) -7 + 24i' do
        assert_equal @complex_number ** 2, ComplexNumber(-7,24)
      end
      test 'The magnitude should be 25' do
        assert_equal (@complex_number ** 2).magnitude, 25
      end
    end

    test_case 'Consider whether 1 + 0i is a member of the Mandelbrot Set within 10 iterations' do
      @complex_number = ComplexNumber(1, 0)

      test '1 + 0i should not be part of the Mandelbrot Set' do
        assert_equal @complex_number.member?(10).class, Integer
      end

      test '1 + 0i should have 1 iterate under 2' do
        assert_equal @complex_number.member?(10), 1
      end
    end
    t1 = Time.now
    @benchmark = t1 - t0
  end

end

test = ComplexNumberTest.new
test.run
test.result
