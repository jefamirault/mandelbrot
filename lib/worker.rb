require_relative 'mandelbrot_factory'
require 'fileutils'
require 'parallel'

class Worker
  attr_accessor :queue, :directory, :job

  def initialize(options = {})
    @directory = options[:directory]
    @queue = options[:queue]
  end

  def get_job
    load_queue
    @job = @queue.pop
    update_queue
  end

  def run
    sleep rand
    @options = { prefix: '' }
    load_queue
    until @queue.size == 0
      get_job
      job = @job

      break if job.nil?


      @options[:step] = job[:step]
      @options[:resolution] = job[:resolution]
      @options[:max_iterations] = job[:iterations]
      @options[:export_location] = "#{@directory}/tiles"
      @options[:mapfile] = "#{@directory}/map/composite_#{job[:index]}"
      @zoom_zero = ZoomZeroFactory.new @options
      @zoom_zero.map = MandelbrotMap.new mapfile: "#{@directory}/map/composite_#{job[:index]}"
      @zoom_zero.map.load

      @zoom_zero.center = job[:center]
      @options[:label] = job[:index]
      @zoom_zero.run @options

      @zoom_zero.map.write overwrite: true
      load_queue
    end
  end

  def load_queue
    File.open("#{@directory}/queue") do |f|
      @queue = Marshal.load(f)
    end
  end
  def update_queue
    File.open("#{@directory}/queue", 'w+') do |f|
      Marshal.dump(@queue, f)
    end
  end
end
