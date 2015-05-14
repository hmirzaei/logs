require 'rubygems/package'
require 'rubygems'
require 'json'
require 'time'
require 'csv'

class LogfilesController < ApplicationController
  http_basic_authenticate_with name: ENV["LOGS_USER"] , password: ENV["LOGS_PASS"]
  include ActionView::Helpers::NumberHelper

  skip_before_filter  :verify_authenticity_token
  Summary = Struct.new(:sim_time, :console, :test_script, :app_scala, :user_cpu, :sys_cpu, :idle)


  def flatten(h,f=[],g={})
    return g.merge!({ f=>h }) unless h.is_a? Hash
    h.each { |k,r| flatten(r,k,g) }
    g
  end

  def find_stage(jobs, stage_id)
    jobs.each { |job|
      s = job["Stages"].select {|k| k["Stage ID"] == stage_id}.min
      return s unless s.nil?
    }
  end
  
  def cascade(a,b) 
    (a.zip b).map{|a_row, b_row| (a_row.zip b_row).map{|a_col, b_col| (a_col.is_a? Array) ? a_col+ [b_col]:[a_col]+[b_col]}} 
  end


  def parse_iostat(s)
    iostat = {}
    csv = s.split("\n\n")[1..-1].map{|x| CSV.parse x, {:col_sep => " "}}
    iostat_raw = csv.inject{|result,n| cascade(result,n)}

    iostat[:dev] =  csv[0][1..-1].transpose[0][1..-1]
    iostat[:var] =  csv[0][1][1..-1]

    f = iostat_raw[0][0..2].transpose.map{|x| x.join(' ')}

    iostat[:time] = iostat_raw[0][0..2].transpose.map{|x| DateTime.strptime(x.join(' '),'%m/%d/%Y %l:%M:%S %p').to_i}
    iostat[:time] = iostat[:time].map{|t| t-iostat[:time][0]}

    iostat[:dat] = iostat_raw[2..-1]
    iostat[:dat].each{|x| x.each{|y| y.map!{|z| z.to_f}}}
    iostat[:dat].each{|row| row.shift}

    iostat
  end

  def parse_cpus(s)
    cpus = {}
    csv = CSV.parse(s, {:col_sep => " "})
    csv.shift
    cpus[:time] = csv.map{|x| DateTime.strptime(x[0]+' '+x[1],'%l:%M:%S %p').to_i}
    cpus[:time] = cpus[:time].map{|t| t-cpus[:time][0]}    
    cpus[:dat] = csv.map{|x| x[3].to_f + x[5].to_f}
    
    cpus
  end

  def parse_mem(s)
    mem = {}
    csv = CSV.parse(s, {:col_sep => ",\t"})
    csv.shift
    mem[:time] = csv.map{|x| DateTime.strptime(x[0],'%L:%M:%S').to_i}
    mem[:time] = mem[:time].map{|t| t-mem[:time][0]}    
    mem[:dat] = csv.map{|x| x[1].to_i}
    
    mem
  end

  def parse_spark_log(s)
    spark_log = []
    s = s.chomp
    s.gsub! "\n",",\n"
    s= "[#{s}]"
    json_arr = JSON.parse(s)
    time = 0
    
    #--------------------------------------------------------------------
    json_arr.each{ |json|
      newEntry = {}
      
      if json["Event"] == "SparkListenerJobStart"  
        
        json.each { |key, value|
          if (key != "Event") && (!value.is_a? Array)
            newEntry[key] = value
          elsif value.is_a? Hash
            newEntry.merge!(flatten(value));
          end
        }
        newEntry["Stages"]=json["Stage Infos"];
        spark_log.push(newEntry)
        #------------------------------------------------------------------
      elsif json["Event"] == "SparkListenerJobEnd" 
        
        prev_entry = spark_log.select {|k| k["Job ID"] == json["Job ID"]}.first
        json.each { |key, value|
          if key != "Event" 
            if value.is_a? Hash
              prev_entry.merge!(flatten(value))
            else
              prev_entry[key] = value
            end
          end
        }
        #------------------------------------------------------------------
      elsif json["Event"] == "SparkListenerTaskStart" 
        
        stage = find_stage(spark_log, json["Stage ID"])
        if stage["Tasks"].nil?
          stage["Tasks"] = [json["Task Info"]]
        else
          stage["Tasks"].push json["Task Info"]
        end
        #------------------------------------------------------------------
      elsif json["Event"] == "SparkListenerTaskEnd" 
        stage = find_stage(spark_log, json["Stage ID"])
        task = stage["Tasks"].select {|k| k["Task ID"] == json["Task Info"]["Task ID"]}.first
        json.each { |key, value|
          if key != "Event" 
            if value.is_a? Hash
              task.merge!(flatten(value))
            else                        
              task[key] = value
            end
          end
        }
        #------------------------------------------------------------------
      end
    }
    table = []
    spark_log.each{ |job|
      if !job["Stages"].nil?
        job["Stages"].each { |stage|
          if !stage["Tasks"].nil?
            stage["Tasks"].each { |task|
              table.push([job.delete_if{|k, v| v.is_a? Array} , stage.delete_if{|k, v| v.is_a? Array} , task.delete_if{|k, v| v.is_a? Array}].inject(&:merge))
            }
          end
        }
      end
    }

    min_time = table.map{|row| row["Submission Time"]}.compact.first
    table.each{ |row| row.each { |key, value| if ["Completion Time", "Submission Time", "Launch Time", "Finish Time"].include? key  then row[key] = row[key] - min_time if !value.nil?  end}}    
    
    table.each{ |row|
      row["Job Duration"] = row.has_key?("Completion Time") ? row["Completion Time"] - row["Submission Time"] : nil
      row["Task Duration"] = row.has_key?("Finish Time") ? row["Finish Time"] - row["Launch Time"] : nil
    }      

    @all_keys = table.map{|x| x.keys}.inject(:|).sort!

    empty_row = Hash[@all_keys.map{ |k| [k, nil]}]
    table.map! { |row| empty_row.merge(row)}

    table = table.sort_by { |row| row["Task ID"] }

    table
  end
  
  def parse_console(console)
    sim_time = console.match(/Simulation Time\D*(\d+).*/)
    if !sim_time.to_a.empty?
      sim_time = sim_time.captures.first
      @summary.sim_time = "#{number_with_delimiter(sim_time, :delimiter => ",")} (ms)"
    else
      @summary.sim_time = "-"
    end
    @summary.console = console
  end

  def index
    @logfiles = Logfile.all
  end
  
  def show
    @logfile = Logfile.find(params[:id]) 
    @summary = Summary.new


    tar_extract = Gem::Package::TarReader.new(File.open(@logfile.attachment.path))
    tar_extract.rewind # The extract has to be rewinded after every iteration
    tar_extract.each do |entry|
      if entry.full_name == "mlapp/out"
        console = entry.read;
        parse_console(console);
      elsif entry.full_name.start_with?("runtest_")
        @summary.test_script = entry.read;
      elsif entry.full_name.ends_with?("scala")
        @summary.app_scala = entry.read;
      elsif entry.full_name.start_with?("spark/spark-events/")
        s = entry.read
        if !s.nil?
          @spark_log=parse_spark_log(s)
        end
      elsif entry.full_name.start_with?("lperf/system/iostat")
        s = entry.read
        if !s.nil?
          @iostat_log=parse_iostat(s)
        end
      elsif entry.full_name.start_with?("lperf/plot/cpus")
        s = entry.read
        if !s.nil?
          @cpus_log=parse_cpus(s)
        end
      elsif entry.full_name.start_with?("lperf/plot/mem")
        s = entry.read
        if !s.nil?
          @mem_log=parse_mem(s)
        end
      elsif entry.full_name.start_with?("lperf/plot/cpus")
        csv = CSV.parse(entry.read, {:col_sep => " "})
        csv.shift
        @summary.user_cpu = csv.map{|x| x[3].to_f}.inject(:+)/csv.length
        @summary.sys_cpu = csv.map{|x| x[5].to_f}.inject(:+)/csv.length
        @summary.idle = csv.map{|x| x[-1].to_f}.inject(:+)/csv.length
      end
    end
    tar_extract.close    
  end

  def new
    @logfile = Logfile.new
  end

  def create
    @logfile = Logfile.new(logfile_params)

    if @logfile.save
      redirect_to logfiles_path, notice: "The logfile #{@logfile.time} has been uploaded."
    else
      render "new"
    end
  end

  def destroy
    @logfile = Logfile.find(params[:id])
    @logfile.destroy
    redirect_to logfiles_path, notice:  "The logfile #{@logfile.time} has been deleted."
  end

  private
  def logfile_params
    
    params.require(:logfile).permit(:time, :app, :tool, :testfile, :noworker, :vmmem, :machinetype, :simtime, :attachment)
  end
end

