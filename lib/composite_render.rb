require_relative 'mandelbrot_factory'
require 'json'
require 'fileutils'

class CompositeRender < MandelbrotFactory
  attr_accessor :center, :iterations, :grid_size, :tile_resolution, :step, :jobs
#  optional: color speed

  def initialize(options = {})
    @center = options[:center] || [-0.75, 0]
    if @center.size != 2
      raise 'invalid composite center coordinates'
    end

    @iterations = options[:iterations] || 1000

    @step = options[:step]

    @tile_resolution = options[:resolution]
    if @tile_resolution.size != 2
      raise 'invalid tile resolution'
    end

    @grid_size = options[:grid_size]

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
          resolution: @tile_resolution,
          # step/pixel width
          step: @step,
          # center of the whole composite image
          center: center,
          # maximum iterations
          iterations: @iterations
      }
    end
  end

end

#
#
# blueprint = JSON.parse File.read("blueprint/sample.json")
#
# @options = blueprint.transform_keys(&:to_sym)
#
# @folder = @options[:directory]
# @jobs = CompositeRender.new(@options).create_jobs
#
# # add jobs to queue
# @queue = []
# @jobs.each do |param|
#   @queue.unshift param
# end
#
# # save queue
# puts "Updating Queue"
#
# FileUtils.mkdir_p @folder
#
# File.open("#{@folder}/queue", 'w+') do |f|
#   Marshal.dump(@queue, f)
# end
