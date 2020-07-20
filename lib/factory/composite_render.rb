require_relative 'mandelbrot_factory'
# require_relative '../composite_image'

class CompositeRender < MandelbrotFactory
  attr_accessor :center, :iterations, :grid_size, :tile_resolution, :step, :jobs
#  optional: color speed

  def initialize(options = {})
    @center = options[:center] || [-0.75, 0]
    if @center.size != 2
      raise 'invalid composite center coordinates'
    end

    @max_iterations = options[:iterations] || 1000

    @step = options[:step]

    @tile_resolution = options[:tile_resolution]
    if @tile_resolution.size != 2
      raise 'invalid tile resolution'
    end

    self
  end

  def tile_width
    @tile_resolution[0]
  end

  def tile_height
    @tile_resolution[1]
  end

  def top_left_tile_center
    x = @center[0] - (@grid_size - 1) * tile_width / 2 * @step
    y = @center[1] + (@grid_size - 1) * tile_height / 2 * @step
    [x, y]
  end

  def create_jobs
    if @jobs
      puts 'Jobs already created.'
      return @jobs
    end
    x_start, y_start = *top_left_tile_center

    tile_centers = []
    (0...@grid_size).each do |y|
      (0...@grid_size).each do |x|
        tile_centers << [x_start + (x * tile_width) * @step, y_start - (y * tile_height) * @step]
      end
    end

    @jobs = tile_centers.each_with_index.map do |center, index|
      {
          index: index,
          #  tile resolution
          resolution: [width, height],
          # step/pixel width
          step: step,
          # center of the whole composite image
          center: center,
          # maximum iterations
          iterations: iterations
      }
    end
  end

end


# Gigapixel Zoomed Out
#
# composite_center = [-0.75, 0]
# iterations = 4000
# grid_size = 16
# symmetric = true
# # precision = 13
# width, height = 3250, 2850
# step = 0.00005


# Render Parameters

# Seahorse Valley

composite_center = [-0.7463, 0.1102]
iterations = 8000
grid_size = 64
# tile resolution
width, height = 740, 416

step = 0.000000078125


# define a job for each tile

# x_start = composite_center[0] - (grid_size - 1) * width / 2 * step
# y_start = composite_center[1] + (grid_size - 1) * height / 2 * step
#
# tile_centers = []
# (0...grid_size).each do |y|
#   (0...grid_size).each do |x|
#     tile_centers << [x_start + (x * width) * step, y_start - (y * height) * step]
#   end
# end
#
# @jobs = tile_centers.each_with_index.map do |center, index|
#   {
#       index: index,
#       #  tile resolution
#       resolution: [width, height],
#       # step/pixel width
#       step: step,
#       # center of the whole composite image
#       center: center,
#       # maximum iterations
#       iterations: iterations
#   }
# end

@folder = 'renders/seahorse/composite_test'

# run jobs

@options = {
    prefix: 'seahorse'
}

@queue = []

# add jobs to queue

@jobs.each do |param|
  @queue.unshift param
end

# save queue
puts "Updating Queue"
File.open("#{@folder}/queue", 'w+') do |f|
  Marshal.dump(@queue, f)
end

