require_relative 'mandelbrot_factory'

class IterationTour < MandelbrotFactory

end

@factory_parameters = [
    { # 0
        precision: 3,
        resolution: [100, 100],
        scale: 64,
        iterations: 0,
        center: [0, 0]
    },
    { # 1
        precision: 4,
        resolution: [100, 100],
        scale: 32,
        iterations: 1,
        center: [0, 0]
    },
    { # 2
        precision: 4,
        resolution: [100, 100],
        scale: 32,
        iterations: 2,
        center: [0, 0]
    },
    { # 3
        precision: 4,
        resolution: [100, 100],
        scale: 32,
        iterations: 3,
        center: [0, 0]
    },
    { # 4
        precision: 4,
        resolution: [100, 100],
        scale: 32,
        iterations: 3,
        center: [-0.63, 0]
    },
    { # 5
        precision: 5,
        resolution: [250, 237],
        scale: 16,
        iterations: 3,
        center: [-0.63, 0]
    },
    { # 6
        precision: 5,
        resolution: [160, 150],
        scale: 16,
        iterations: 4,
        center: [-0.63, 0]
    },
    { # 7
        precision: 5,
        resolution: [160, 150],
        scale: 16,
        iterations: 5,
        center: [-0.63, 0]
    },
    { # 8
        precision: 6,
        resolution: [320, 300],
        scale: 8,
        iterations: 5,
        center: [-0.63, 0]
    },
    { # 9
        precision: 6,
        resolution: [320, 300],
        scale: 8,
        iterations: 6,
        center: [-0.63, 0]
    },
    { # 10
        precision: 6,
        resolution: [320, 300],
        scale: 8,
        iterations: 7,
        center: [-0.63, 0]
    },
    { # 11
        precision: 6,
        resolution: [320, 300],
        scale: 8,
        iterations: 8,
        center: [-0.63, 0]
    },
    { # 12
        precision: 7,
        resolution: [600, 570],
        scale: 4,
        iterations: 8,
        center: [-0.63, 0]
    },
    { # 13
        precision: 7,
        resolution: [600, 570],
        scale: 4,
        iterations: 9,
        center: [-0.63, 0]
    },
    { # 14
        precision: 7,
        resolution: [600, 570],
        scale: 4,
        iterations: 10,
        center: [-0.63, 0]
    },
    { # 15
        precision: 7,
        resolution: [600, 570],
        scale: 4,
        iterations: 11,
        center: [-0.63, 0]
    },
    { # 16
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 11,
        center: [-0.63, 0]
    },
    { # 17
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 12,
        center: [-0.7, 0]
    },
    { # 18
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 13,
        center: [-0.7, 0]
    },
    { # 19
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 14,
        center: [-0.7, 0]
    },
    { # 20
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 15,
        center: [-0.7, 0]
    },
    { # 21
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 16,
        center: [-0.7, 0]
    },
    { # 22
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 17,
        center: [-0.7, 0]
    },
    { # 23
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 18,
        center: [-0.7, 0]
    },
    { # 24
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 19,
        center: [-0.7, 0]
    },
    { # 25
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 20,
        center: [-0.7, 0]
    },
    { # 26
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 21,
        center: [-0.7, 0]
    },
    { # 27
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 22,
        center: [-0.7, 0]
    },
    { # 28
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 23,
        center: [-0.7, 0]
    },
    { # 29
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 24,
        center: [-0.7, 0]
    },
    { # 30
        precision: 8,
        resolution: [1300, 1150],
        scale: 2,
        iterations: 25,
        center: [-0.7, 0]
    },
    { # 31
        precision: 9,
        resolution: [2600, 2300],
        scale: 1,
        iterations: 25,
        center: [-0.7, 0]
    },
    { # 32
        precision: 9,
        resolution: [2600, 2300],
        scale: 1,
        iterations: 50,
        center: [-0.7, 0]
    },
    { # 33
        precision: 9,
        resolution: [2600, 2300],
        scale: 1,
        iterations: 100,
        center: [-0.7, 0]
    },
    { # 34
        precision: 9,
        resolution: [2600, 2300],
        scale: 1,
        iterations: 1000,
        center: [-0.7, 0]
    }
]

@options = {}

if ARGV[0] == 'fast'
    @options[:fast] = true
elsif ARGV[0] == 'slow'
    @options[:slow] = true
end


folder = 'renders/test/iterations'
@options[:color_speed] = 100
@factory = ZoomZeroFactory.new [[100, 100]], directory: folder

range = if @options[:fast]
          0..3
        elsif options[:slow]
          0..15
        else
          0..6
        end

@factory_parameters[range].each_with_index do |params, index|
  @factory.max_iterations = params[:iterations]
  @factory.precisions = params[:precision]
  @factory.scale = params[:scale]
  @factory.resolution = params[:resolution]
  @factory.center = params[:center]
  @factory.run @options
end

@factory.map.write overwrite: true
